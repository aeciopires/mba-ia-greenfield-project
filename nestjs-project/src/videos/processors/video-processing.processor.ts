import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import ffmpeg from 'fluent-ffmpeg';
import { Video, VideoStatus } from '../entities/video.entity';
import { StorageService } from '../../storage/storage.service';
import { VIDEO_PROCESSING_QUEUE } from '../../queue/queue.constants';
import type { VideoProcessingJobData } from '../../queue/video-processing.queue';

@Processor(VIDEO_PROCESSING_QUEUE)
export class VideoProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoProcessingProcessor.name);

  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    private readonly storageService: StorageService,
  ) {
    super();
  }

  async process(job: Job<VideoProcessingJobData>): Promise<void> {
    const { videoId, storageKey } = job.data;
    this.logger.log(`Processing video ${videoId}`);

    let thumbnailPath: string | null = null;

    try {
      const videoUrl =
        await this.storageService.generateInternalDownloadPresignedUrl(
          storageKey,
          3600,
        );

      const probeData = await this.probeVideo(videoUrl);
      const rawDuration = probeData.format.duration;
      const duration = rawDuration != null ? Math.round(rawDuration) : 0;

      const slashIndex = storageKey.lastIndexOf('/');
      const thumbnailKey =
        storageKey.substring(0, slashIndex + 1) + 'thumbnail.jpg';
      thumbnailPath = path.join(os.tmpdir(), `thumbnail-${videoId}.jpg`);

      const seekSeconds = duration > 10 ? Math.round(duration * 0.1) : 1;
      await this.generateThumbnail(videoUrl, seekSeconds, thumbnailPath);

      const thumbnailBuffer = fs.readFileSync(thumbnailPath);
      await this.storageService.putObject(
        thumbnailKey,
        thumbnailBuffer,
        'image/jpeg',
      );

      const video = await this.videoRepository.findOneBy({ id: videoId });
      if (video) {
        video.status = VideoStatus.READY;
        video.duration = duration;
        video.metadata = probeData.format;
        video.thumbnail_key = thumbnailKey;
        video.error_message = null;
        await this.videoRepository.save(video);
      }

      this.logger.log(`Video ${videoId} processed successfully`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to process video ${videoId}: ${message}`);

      await this.videoRepository.update(videoId, {
        status: VideoStatus.ERROR,
        error_message: message,
      });
    } finally {
      if (thumbnailPath) {
        try {
          fs.unlinkSync(thumbnailPath);
        } catch {
          // ignore temp file cleanup errors
        }
      }
    }
  }

  private probeVideo(
    url: string,
  ): Promise<{ format: { duration?: number; [key: string]: unknown } }> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(url, (err, data) => {
        if (err) reject(err instanceof Error ? err : new Error(String(err)));
        else
          resolve(
            data as { format: { duration?: number; [key: string]: unknown } },
          );
      });
    });
  }

  private generateThumbnail(
    url: string,
    seekSeconds: number,
    outputPath: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(url)
        .seekInput(seekSeconds)
        .frames(1)
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
        .run();
    });
  }
}
