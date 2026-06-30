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
import { CommentLikesService } from './comment-likes.service';
import { VoteDto } from '../video-likes/dto/vote.dto';

@ApiTags('comments')
@Controller('comments')
export class CommentLikesController {
  constructor(private readonly commentLikesService: CommentLikesService) {}

  @Post(':id/likes')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Like or dislike a comment',
    description:
      'Adds a like or dislike to a comment. If the same type exists, toggles it off.',
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
    description: 'Comment not found',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async upsertVote(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: VoteDto,
  ) {
    return this.commentLikesService.upsertVote(user.sub, id, dto.type);
  }

  @Delete(':id/likes')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Remove comment vote',
    description: "Removes the current user's like or dislike from the comment.",
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
    description: 'Comment not found',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async removeVote(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.commentLikesService.removeVote(user.sub, id);
  }
}
