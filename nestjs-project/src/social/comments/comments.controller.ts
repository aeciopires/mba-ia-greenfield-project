import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ApiErrorEnvelope } from '../../common/openapi/api-error-envelope.dto';
import { Public } from '../../auth/decorators/public.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/auth.types';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@ApiTags('comments')
@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Public()
  @Get('videos/:slug/comments')
  @ApiOperation({
    summary: 'List video comments',
    description: 'Returns paginated top-level comments with their replies.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated comments',
    schema: {
      properties: {
        data: { type: 'array', items: { type: 'object' } },
        total: { type: 'number' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Video not found',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async findByVideo(
    @Param('slug') slug: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.commentsService.findByVideo(slug, Number(page), Number(limit));
  }

  @Post('videos/:slug/comments')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Create comment',
    description: 'Adds a top-level comment to a video.',
  })
  @ApiResponse({
    status: 201,
    description: 'Comment created',
    schema: { type: 'object' },
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
  async createComment(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(user.sub, slug, dto);
  }

  @Post('comments/:id/replies')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Reply to comment',
    description:
      'Adds a reply to an existing top-level comment. Max depth is 1.',
  })
  @ApiResponse({
    status: 201,
    description: 'Reply created',
    schema: { type: 'object' },
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
  @ApiResponse({
    status: 422,
    description: 'Replies to replies not allowed',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async replyToComment(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.createReply(user.sub, id, dto);
  }

  @Delete('comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Delete comment',
    description: 'Deletes a comment owned by the authenticated user.',
  })
  @ApiResponse({ status: 204, description: 'Comment deleted' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 404,
    description: 'Comment not found or not owned by user',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async deleteComment(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<void> {
    await this.commentsService.delete(id, user.sub);
  }
}
