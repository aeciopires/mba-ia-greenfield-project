import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Video } from '../videos/entities/video.entity';
import { Channel } from '../channels/entities/channel.entity';
import { VideoLike } from './video-likes/video-like.entity';
import { Comment } from './comments/comment.entity';
import { CommentLike } from './comment-likes/comment-like.entity';
import { ChannelSubscription } from './subscriptions/channel-subscription.entity';
import { VideoLikesService } from './video-likes/video-likes.service';
import { VideoLikesController } from './video-likes/video-likes.controller';
import { CommentsService } from './comments/comments.service';
import { CommentsController } from './comments/comments.controller';
import { CommentLikesService } from './comment-likes/comment-likes.service';
import { CommentLikesController } from './comment-likes/comment-likes.controller';
import { SubscriptionsService } from './subscriptions/subscriptions.service';
import { SubscriptionsController } from './subscriptions/subscriptions.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Video,
      Channel,
      VideoLike,
      Comment,
      CommentLike,
      ChannelSubscription,
    ]),
  ],
  providers: [
    VideoLikesService,
    CommentsService,
    CommentLikesService,
    SubscriptionsService,
  ],
  controllers: [
    VideoLikesController,
    CommentsController,
    CommentLikesController,
    SubscriptionsController,
  ],
})
export class SocialModule {}
