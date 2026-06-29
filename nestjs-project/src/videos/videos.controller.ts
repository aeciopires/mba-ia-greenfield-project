import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ApiErrorEnvelope } from '../common/openapi/api-error-envelope.dto';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.types';
import { ChannelsService } from '../channels/channels.service';
import { VideosService } from './videos.service';
import { CreateVideoDto } from './dto/create-video.dto';
import { QueryVideosDto } from './dto/query-videos.dto';

@ApiTags('videos')
@Controller('videos')
export class VideosController {
  constructor(
    private readonly videosService: VideosService,
    private readonly channelsService: ChannelsService,
  ) {}

  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Initiate video upload',
    description:
      'Creates a draft video record and returns a presigned URL for direct upload to object storage.',
  })
  @ApiResponse({
    status: 201,
    description: 'Draft video created; presigned upload URL returned',
    schema: {
      properties: {
        video: { type: 'object' },
        presigned_upload_url: { type: 'string', format: 'uri' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async initiateUpload(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateVideoDto,
  ) {
    const channel = await this.channelsService.findByUserId(user.sub);
    if (!channel) {
      throw new NotFoundException('Channel not found for user');
    }
    return this.videosService.initiateUpload(channel.id, dto);
  }

  @Patch(':id/start-processing')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Notify upload complete and start processing',
    description:
      'Transitions the video from draft to processing and enqueues the FFmpeg job.',
  })
  @ApiResponse({
    status: 200,
    description: 'Video queued for processing',
    schema: { type: 'object' },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 404,
    description: 'Video not found or not owned by the authenticated user',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 409,
    description: 'Video is not in draft status',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async startProcessing(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const channel = await this.channelsService.findByUserId(user.sub);
    if (!channel) {
      throw new NotFoundException('Channel not found for user');
    }
    return this.videosService.startProcessing(id, channel.id);
  }

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List ready videos',
    description: 'Returns a paginated list of videos with status=ready.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of videos',
    schema: {
      properties: {
        data: { type: 'array', items: { type: 'object' } },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  })
  async findAll(@Query() query: QueryVideosDto) {
    const { data, total } = await this.videosService.findAll(query);
    return {
      data,
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    };
  }

  @Public()
  @Get(':slug')
  @ApiOperation({
    summary: 'Get video by slug',
    description: 'Returns a ready video by its unique slug.',
  })
  @ApiResponse({
    status: 200,
    description: 'Video details',
    schema: { type: 'object' },
  })
  @ApiResponse({
    status: 404,
    description: 'Video not found or not ready',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async findBySlug(@Param('slug') slug: string) {
    return this.videosService.findBySlug(slug);
  }

  @Public()
  @Get(':slug/stream')
  @ApiOperation({
    summary: 'Stream video',
    description:
      'Redirects to a presigned MinIO URL for streaming (supports HTTP Range requests natively).',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirect to presigned stream URL',
  })
  @ApiResponse({
    status: 404,
    description: 'Video not found or not ready',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async streamVideo(
    @Param('slug') slug: string,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.videosService.getStreamUrl(slug);
    res.redirect(302, url);
  }

  @Public()
  @Get(':slug/download')
  @ApiOperation({
    summary: 'Download video',
    description:
      'Redirects to a presigned MinIO URL with content-disposition: attachment.',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirect to presigned download URL',
  })
  @ApiResponse({
    status: 404,
    description: 'Video not found or not ready',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async downloadVideo(
    @Param('slug') slug: string,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.videosService.getDownloadUrl(slug);
    res.redirect(302, url);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Delete video',
    description:
      'Deletes a video and its associated storage objects (video file and thumbnail).',
  })
  @ApiResponse({ status: 204, description: 'Video deleted' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 404,
    description: 'Video not found or not owned by the authenticated user',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async deleteVideo(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<void> {
    const channel = await this.channelsService.findByUserId(user.sub);
    if (!channel) {
      throw new NotFoundException('Channel not found for user');
    }
    await this.videosService.delete(id, channel.id);
  }
}
