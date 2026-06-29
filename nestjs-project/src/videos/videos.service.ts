import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { nanoid } from 'nanoid';
import type { ConfigType } from '@nestjs/config';
import { Video, VideoStatus } from './entities/video.entity';
import { CreateVideoDto } from './dto/create-video.dto';
import { QueryVideosDto } from './dto/query-videos.dto';
import { StorageService } from '../storage/storage.service';
import storageConfig from '../config/storage.config';
import { VIDEO_PROCESSING_QUEUE } from '../queue/queue.constants';
import type { VideoProcessingJobData } from '../queue/video-processing.queue';
import {
  VideoNotFoundException,
  VideoNotInDraftStatusException,
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

  async findAll(
    query: QueryVideosDto,
  ): Promise<{ data: Video[]; total: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await this.videoRepository.findAndCount({
      where: { status: VideoStatus.READY },
      order: { created_at: 'DESC' },
      skip,
      take: limit,
    });

    return { data, total };
  }

  async findBySlug(slug: string): Promise<Video> {
    const video = await this.videoRepository.findOne({
      where: { slug, status: VideoStatus.READY },
    });
    if (!video) {
      throw new VideoNotFoundException();
    }
    return video;
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
