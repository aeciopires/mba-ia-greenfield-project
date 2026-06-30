import { Body, Controller, Delete, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ApiErrorEnvelope } from '../../common/openapi/api-error-envelope.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/auth.types';
import { VideoLikesService } from './video-likes.service';
import { VoteDto } from './dto/vote.dto';

@ApiTags('videos')
@Controller('videos')
export class VideoLikesController {
  constructor(private readonly videoLikesService: VideoLikesService) {}

  @Post(':slug/likes')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Like or dislike a video',
    description:
      'Adds a like or dislike. If the same type exists, toggles it off.',
  })
  @ApiResponse({
    status: 200,
    description: 'Vote recorded',
    schema: {
      properties: {
        likes_count: { type: 'number' },
        dislikes_count: { type: 'number' },
        user_vote: { type: 'string', nullable: true },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 404,
    description: 'Video not found',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async upsertVote(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Body() dto: VoteDto,
  ) {
    return this.videoLikesService.upsertVote(user.sub, slug, dto.type);
  }

  @Delete(':slug/likes')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Remove video vote',
    description: "Removes the current user's like or dislike from the video.",
  })
  @ApiResponse({
    status: 200,
    description: 'Vote removed',
    schema: {
      properties: {
        likes_count: { type: 'number' },
        dislikes_count: { type: 'number' },
        user_vote: { type: 'null' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 404,
    description: 'Video not found',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async removeVote(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
  ) {
    return this.videoLikesService.removeVote(user.sub, slug);
  }
}
