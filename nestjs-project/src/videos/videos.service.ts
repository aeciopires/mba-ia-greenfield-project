import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { nanoid } from 'nanoid';
import type { ConfigType } from '@nestjs/config';
import { Video, VideoStatus, VideoVisibility } from './entities/video.entity';
import { CreateVideoDto } from './dto/create-video.dto';
import { QueryVideosDto } from './dto/query-videos.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { StorageService } from '../storage/storage.service';
import { CategoriesService } from '../categories/categories.service';
import storageConfig from '../config/storage.config';
import { VIDEO_PROCESSING_QUEUE } from '../queue/queue.constants';
import type { VideoProcessingJobData } from '../queue/video-processing.queue';
import {
  CategoryNotFoundException,
  VideoNotFoundException,
  VideoNotInDraftStatusException,
  VideoNotReadyException,
  VideoAlreadyPublishedException,
} from '../common/exceptions/domain.exception';
import {
  CONTENT_TYPE_TO_EXTENSION,
  DEFAULT_VIDEO_EXTENSION,
} from './videos.constants';

@Injectable()
export class VideosService {
  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    private readonly storageService: StorageService,
    private readonly categoriesService: CategoriesService,
    @InjectQueue(VIDEO_PROCESSING_QUEUE)
    private readonly videoQueue: Queue<VideoProcessingJobData>,
    @Inject(storageConfig.KEY)
    private readonly config: ConfigType<typeof storageConfig>,
  ) {}

  async initiateUpload(
    channelId: string,
    dto: CreateVideoDto,
  ): Promise<{ video: Video; presigned_upload_url: string }> {
    const slug = nanoid();
    const ext =
      CONTENT_TYPE_TO_EXTENSION[dto.content_type] ?? DEFAULT_VIDEO_EXTENSION;
    const storage_key = `channels/${channelId}/videos/${slug}/original${ext}`;

    const video = this.videoRepository.create({
      channel_id: channelId,
      title: dto.title,
      description: dto.description ?? null,
      status: VideoStatus.DRAFT,
      visibility: VideoVisibility.PUBLIC,
      slug,
      storage_key,
    });
    await this.videoRepository.save(video);

    const presigned_upload_url =
      await this.storageService.generateUploadPresignedUrl(
        storage_key,
        dto.content_type,
        this.config.presignedUrlExpiresIn,
      );

    return { video, presigned_upload_url };
  }

  async startProcessing(videoId: string, channelId: string): Promise<Video> {
    const video = await this.videoRepository.findOne({
      where: { id: videoId },
    });

    if (!video || video.channel_id !== channelId) {
      throw new VideoNotFoundException();
    }

    if (video.status !== VideoStatus.DRAFT) {
      throw new VideoNotInDraftStatusException();
    }

    video.status = VideoStatus.PROCESSING;
    await this.videoRepository.save(video);

    await this.videoQueue.add(
      VIDEO_PROCESSING_QUEUE,
      {
        videoId: video.id,
        channelId: video.channel_id,
        storageKey: video.storage_key!,
      },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );

    return video;
  }

  async updateVideo(
    videoId: string,
    channelId: string,
    dto: UpdateVideoDto,
  ): Promise<Video> {
    const video = await this.videoRepository.findOne({
      where: { id: videoId },
    });

    if (!video || video.channel_id !== channelId) {
      throw new VideoNotFoundException();
    }

    if (dto.category_id !== undefined) {
      if (dto.category_id) {
        const category = await this.categoriesService.findById(dto.category_id);
        if (!category) throw new CategoryNotFoundException();
        video.category_id = category.id;
      } else {
        video.category_id = null;
      }
    }

    if (dto.title !== undefined) video.title = dto.title;
    if (dto.description !== undefined) video.description = dto.description;
    if (dto.visibility !== undefined) video.visibility = dto.visibility;

    return this.videoRepository.save(video);
  }

  async getThumbnailUploadUrl(
    videoId: string,
    channelId: string,
  ): Promise<{ thumbnail_upload_url: string }> {
    const video = await this.videoRepository.findOne({
      where: { id: videoId },
    });

    if (!video || video.channel_id !== channelId) {
      throw new VideoNotFoundException();
    }

    const thumbnailKey = `channels/${channelId}/videos/${video.slug}/thumbnail-custom.jpg`;
    const url = await this.storageService.generateUploadPresignedUrl(
      thumbnailKey,
      'image/jpeg',
      3600,
    );

    return { thumbnail_upload_url: url };
  }

  async publishVideo(videoId: string, channelId: string): Promise<Video> {
    const video = await this.videoRepository.findOne({
      where: { id: videoId },
    });

    if (!video || video.channel_id !== channelId) {
      throw new VideoNotFoundException();
    }

    if (video.status !== VideoStatus.READY) {
      throw new VideoNotReadyException();
    }

    if (video.published_at !== null) {
      throw new VideoAlreadyPublishedException();
    }

    video.published_at = new Date();
    return this.videoRepository.save(video);
  }

  async findAll(
    query: QueryVideosDto,
  ): Promise<{ data: Video[]; total: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.videoRepository
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.channel', 'ch')
      .leftJoinAndSelect('v.category', 'cat')
      .where('v.status = :status', { status: VideoStatus.READY })
      .andWhere('v.visibility = :visibility', {
        visibility: VideoVisibility.PUBLIC,
      });

    if (query.category_id) {
      qb.andWhere('v.category_id = :categoryId', {
        categoryId: query.category_id,
      });
    }

    if (query.channel_id) {
      qb.andWhere('v.channel_id = :channelId', { channelId: query.channel_id });
    }

    if (query.q) {
      const search = `%${query.q}%`;
      qb.andWhere('(v.title ILIKE :search OR ch.nickname ILIKE :search)', {
        search,
      });
    }

    qb.orderBy('v.view_count', 'DESC').addOrderBy('v.created_at', 'DESC');
    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findByIdForStudio(videoId: string, channelId: string): Promise<Video> {
    const video = await this.videoRepository.findOne({
      where: { id: videoId },
      relations: ['category'],
    });
    if (!video || video.channel_id !== channelId) {
      throw new VideoNotFoundException();
    }
    return video;
  }

  async findBySlug(slug: string): Promise<Video> {
    const video = await this.videoRepository.findOne({
      where: { slug, status: VideoStatus.READY },
      relations: ['channel', 'category'],
    });
    if (!video) {
      throw new VideoNotFoundException();
    }
    return video;
  }

  async incrementViewCount(slug: string): Promise<void> {
    await this.videoRepository
      .createQueryBuilder()
      .update(Video)
      .set({ view_count: () => 'view_count + 1' })
      .where('slug = :slug AND status = :status', {
        slug,
        status: VideoStatus.READY,
      })
      .execute();
  }

  async getSuggestions(slug: string): Promise<Video[]> {
    const video = await this.videoRepository.findOne({
      where: { slug, status: VideoStatus.READY },
    });

    if (!video) {
      return [];
    }

    const qb = this.videoRepository
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.channel', 'ch')
      .where('v.status = :status', { status: VideoStatus.READY })
      .andWhere('v.visibility = :visibility', {
        visibility: VideoVisibility.PUBLIC,
      })
      .andWhere('v.slug != :slug', { slug })
      .orderBy('v.view_count', 'DESC')
      .take(10);

    if (video.category_id) {
      qb.andWhere('v.category_id = :categoryId', {
        categoryId: video.category_id,
      });
    }

    return qb.getMany();
  }

  async getStreamUrl(slug: string): Promise<string> {
    const video = await this.findBySlug(slug);
    return this.storageService.generateDownloadPresignedUrl(
      video.storage_key!,
      3600,
    );
  }

  async getDownloadUrl(slug: string): Promise<string> {
    const video = await this.findBySlug(slug);
    const safeTitle = video.title.replace(/[^a-z0-9_\-.]/gi, '_');
    return this.storageService.generateDownloadPresignedUrl(
      video.storage_key!,
      3600,
      `attachment; filename="${safeTitle}.mp4"`,
    );
  }

  async findChannelVideos(
    channelId: string,
    query: QueryVideosDto,
  ): Promise<{ data: Video[]; total: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await this.videoRepository.findAndCount({
      where: {
        channel_id: channelId,
        status: VideoStatus.READY,
        visibility: VideoVisibility.PUBLIC,
      },
      relations: ['channel', 'category'],
      order: { published_at: 'DESC' },
      skip,
      take: limit,
    });

    return { data, total };
  }

  async findChannelStudioVideos(
    channelId: string,
    query: QueryVideosDto,
  ): Promise<{ data: Video[]; total: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await this.videoRepository.findAndCount({
      where: { channel_id: channelId },
      relations: ['category'],
      order: { created_at: 'DESC' },
      skip,
      take: limit,
    });

    return { data, total };
  }

  async delete(videoId: string, channelId: string): Promise<void> {
    const video = await this.videoRepository.findOne({
      where: { id: videoId },
    });

    if (!video || video.channel_id !== channelId) {
      throw new VideoNotFoundException();
    }

    if (video.storage_key) {
      await this.storageService.deleteObject(video.storage_key);
    }
    if (video.thumbnail_key) {
      await this.storageService.deleteObject(video.thumbnail_key);
    }

    await this.videoRepository.remove(video);
  }
}
