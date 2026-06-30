import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommentLike } from './comment-like.entity';
import { Comment } from '../comments/comment.entity';
import { VoteType } from '../video-likes/video-like.entity';
import { CommentNotFoundException } from '../../common/exceptions/domain.exception';

@Injectable()
export class CommentLikesService {
  constructor(
    @InjectRepository(CommentLike)
    private readonly commentLikeRepository: Repository<CommentLike>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
  ) {}

  async upsertVote(
    userId: string,
    commentId: string,
    type: VoteType,
  ): Promise<{
    likes_count: number;
    dislikes_count: number;
    user_vote: VoteType | null;
  }> {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
    });
    if (!comment) throw new CommentNotFoundException();

    const existing = await this.commentLikeRepository.findOne({
      where: { user_id: userId, comment_id: commentId },
    });

    if (existing && existing.type === type) {
      await this.commentLikeRepository.delete({
        user_id: userId,
        comment_id: commentId,
      });
      await this.adjustCounters(commentId, type, -1);
      const updated = await this.commentRepository.findOne({
        where: { id: commentId },
      });
      return {
        likes_count: updated!.likes_count,
        dislikes_count: updated!.dislikes_count,
        user_vote: null,
      };
    }

    if (existing) {
      const oldType = existing.type;
      existing.type = type;
      await this.commentLikeRepository.save(existing);
      await this.adjustCounters(commentId, oldType, -1);
      await this.adjustCounters(commentId, type, 1);
    } else {
      await this.commentLikeRepository.save(
        this.commentLikeRepository.create({
          user_id: userId,
          comment_id: commentId,
          type,
        }),
      );
      await this.adjustCounters(commentId, type, 1);
    }

    const updated = await this.commentRepository.findOne({
      where: { id: commentId },
    });
    return {
      likes_count: updated!.likes_count,
      dislikes_count: updated!.dislikes_count,
      user_vote: type,
    };
  }

  async removeVote(
    userId: string,
    commentId: string,
  ): Promise<{ likes_count: number; dislikes_count: number; user_vote: null }> {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
    });
    if (!comment) throw new CommentNotFoundException();

    const existing = await this.commentLikeRepository.findOne({
      where: { user_id: userId, comment_id: commentId },
    });

    if (existing) {
      await this.commentLikeRepository.delete({
        user_id: userId,
        comment_id: commentId,
      });
      await this.adjustCounters(commentId, existing.type, -1);
    }

    const updated = await this.commentRepository.findOne({
      where: { id: commentId },
    });
    return {
      likes_count: updated!.likes_count,
      dislikes_count: updated!.dislikes_count,
      user_vote: null,
    };
  }

  private async adjustCounters(
    commentId: string,
    type: VoteType,
    delta: number,
  ): Promise<void> {
    const column = type === VoteType.LIKE ? 'likes_count' : 'dislikes_count';
    await this.commentRepository
      .createQueryBuilder()
      .update(Comment)
      .set({ [column]: () => `${column} + ${delta}` })
      .where('id = :id', { id: commentId })
      .execute();
  }
}
