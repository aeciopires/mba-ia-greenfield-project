import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VideoLike, VoteType } from './video-like.entity';
import { Video } from '../../videos/entities/video.entity';
import { VideoNotFoundException } from '../../common/exceptions/domain.exception';

@Injectable()
export class VideoLikesService {
  constructor(
    @InjectRepository(VideoLike)
    private readonly videoLikeRepository: Repository<VideoLike>,
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
  ) {}

  async upsertVote(
    userId: string,
    slug: string,
    type: VoteType,
  ): Promise<{
    likes_count: number;
    dislikes_count: number;
    user_vote: VoteType | null;
  }> {
    const video = await this.videoRepository.findOne({ where: { slug } });
    if (!video) throw new VideoNotFoundException();

    const existing = await this.videoLikeRepository.findOne({
      where: { user_id: userId, video_id: video.id },
    });

    if (existing && existing.type === type) {
      // Same type: toggle off (remove vote)
      await this.videoLikeRepository.delete({
        user_id: userId,
        video_id: video.id,
      });
      await this.adjustCounters(video.id, type, -1);
      const updated = await this.videoRepository.findOne({
        where: { id: video.id },
      });
      return {
        likes_count: updated!.likes_count,
        dislikes_count: updated!.dislikes_count,
        user_vote: null,
      };
    }

    if (existing) {
      // Different type: switch vote
      const oldType = existing.type;
      existing.type = type;
      await this.videoLikeRepository.save(existing);
      await this.adjustCounters(video.id, oldType, -1);
      await this.adjustCounters(video.id, type, 1);
    } else {
      // New vote
      await this.videoLikeRepository.save(
        this.videoLikeRepository.create({
          user_id: userId,
          video_id: video.id,
          type,
        }),
      );
      await this.adjustCounters(video.id, type, 1);
    }

    const updated = await this.videoRepository.findOne({
      where: { id: video.id },
    });
    return {
      likes_count: updated!.likes_count,
      dislikes_count: updated!.dislikes_count,
      user_vote: type,
    };
  }

  async removeVote(
    userId: string,
    slug: string,
  ): Promise<{ likes_count: number; dislikes_count: number; user_vote: null }> {
    const video = await this.videoRepository.findOne({ where: { slug } });
    if (!video) throw new VideoNotFoundException();

    const existing = await this.videoLikeRepository.findOne({
      where: { user_id: userId, video_id: video.id },
    });

    if (existing) {
      await this.videoLikeRepository.delete({
        user_id: userId,
        video_id: video.id,
      });
      await this.adjustCounters(video.id, existing.type, -1);
    }

    const updated = await this.videoRepository.findOne({
      where: { id: video.id },
    });
    return {
      likes_count: updated!.likes_count,
      dislikes_count: updated!.dislikes_count,
      user_vote: null,
    };
  }

  private async adjustCounters(
    videoId: string,
    type: VoteType,
    delta: number,
  ): Promise<void> {
    const column = type === VoteType.LIKE ? 'likes_count' : 'dislikes_count';
    await this.videoRepository
      .createQueryBuilder()
      .update(Video)
      .set({ [column]: () => `${column} + ${delta}` })
      .where('id = :id', { id: videoId })
      .execute();
  }
}
