import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Comment } from './comment.entity';
import { Video } from '../../videos/entities/video.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import {
  CommentNotFoundException,
  CommentNestingNotAllowedException,
  VideoNotFoundException,
} from '../../common/exceptions/domain.exception';

export interface CommentWithReplies extends Comment {
  replies: Comment[];
}

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
  ) {}

  async findByVideo(
    slug: string,
    page: number,
    limit: number,
  ): Promise<{ data: CommentWithReplies[]; total: number }> {
    const video = await this.videoRepository.findOne({ where: { slug } });
    if (!video) throw new VideoNotFoundException();

    const skip = (page - 1) * limit;
    const [topLevel, total] = await this.commentRepository.findAndCount({
      where: { video_id: video.id, parent_id: IsNull() },
      relations: ['user'],
      order: { created_at: 'DESC' },
      skip,
      take: limit,
    });

    const ids = topLevel.map((c) => c.id);
    const replies =
      ids.length > 0
        ? await this.commentRepository
            .createQueryBuilder('r')
            .leftJoinAndSelect('r.user', 'u')
            .where('r.parent_id IN (:...ids)', { ids })
            .orderBy('r.created_at', 'ASC')
            .getMany()
        : [];

    const replyMap = new Map<string, Comment[]>();
    for (const reply of replies) {
      const list = replyMap.get(reply.parent_id!) ?? [];
      list.push(reply);
      replyMap.set(reply.parent_id!, list);
    }

    const data: CommentWithReplies[] = topLevel.map((c) => ({
      ...c,
      replies: replyMap.get(c.id) ?? [],
    }));

    return { data, total };
  }

  async create(
    userId: string,
    slug: string,
    dto: CreateCommentDto,
    parentId?: string,
  ): Promise<Comment> {
    const video = await this.videoRepository.findOne({ where: { slug } });
    if (!video) throw new VideoNotFoundException();

    if (parentId) {
      const parent = await this.commentRepository.findOne({
        where: { id: parentId },
      });
      if (!parent) throw new CommentNotFoundException();
      if (parent.parent_id !== null)
        throw new CommentNestingNotAllowedException();
    }

    const comment = this.commentRepository.create({
      video_id: video.id,
      user_id: userId,
      content: dto.content,
      parent_id: parentId ?? null,
    });
    await this.commentRepository.save(comment);

    // Increment comments_count only for top-level comments
    if (!parentId) {
      await this.videoRepository
        .createQueryBuilder()
        .update(Video)
        .set({ comments_count: () => 'comments_count + 1' })
        .where('id = :id', { id: video.id })
        .execute();
    }

    return comment;
  }

  async createReply(
    userId: string,
    parentId: string,
    dto: CreateCommentDto,
  ): Promise<Comment> {
    const parent = await this.commentRepository.findOne({
      where: { id: parentId },
    });
    if (!parent) throw new CommentNotFoundException();
    if (parent.parent_id !== null)
      throw new CommentNestingNotAllowedException();

    const video = await this.videoRepository.findOne({
      where: { id: parent.video_id },
    });
    if (!video) throw new VideoNotFoundException();

    const comment = this.commentRepository.create({
      video_id: parent.video_id,
      user_id: userId,
      content: dto.content,
      parent_id: parentId,
    });
    return this.commentRepository.save(comment);
  }

  async delete(commentId: string, userId: string): Promise<void> {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
    });
    if (!comment) throw new CommentNotFoundException();
    if (comment.user_id !== userId) throw new CommentNotFoundException();

    const isTopLevel = comment.parent_id === null;
    await this.commentRepository.delete({ id: commentId });

    if (isTopLevel) {
      await this.videoRepository
        .createQueryBuilder()
        .update(Video)
        .set({ comments_count: () => 'GREATEST(comments_count - 1, 0)' })
        .where('id = :id', { id: comment.video_id })
        .execute();
    }
  }
}
