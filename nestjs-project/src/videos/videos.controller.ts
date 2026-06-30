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
import { UpdateVideoDto } from './dto/update-video.dto';

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
    if (!channel) throw new NotFoundException('Channel not found for user');
    return this.videosService.initiateUpload(channel.id, dto);
  }

  @Patch(':id/start-processing')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Start video processing',
    description:
      'Transitions video from draft to processing and enqueues the FFmpeg job.',
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
    description: 'Video not found',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 409,
    description: 'Video not in draft status',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async startProcessing(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const channel = await this.channelsService.findByUserId(user.sub);
    if (!channel) throw new NotFoundException('Channel not found for user');
    return this.videosService.startProcessing(id, channel.id);
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update video metadata',
    description:
      'Updates title, description, category, or visibility of a video.',
  })
  @ApiResponse({
    status: 200,
    description: 'Video updated',
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
  async updateVideo(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateVideoDto,
  ) {
    const channel = await this.channelsService.findByUserId(user.sub);
    if (!channel) throw new NotFoundException('Channel not found for user');
    return this.videosService.updateVideo(id, channel.id, dto);
  }

  @Post(':id/thumbnail')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get thumbnail upload URL',
    description: 'Returns a presigned URL to upload a custom thumbnail image.',
  })
  @ApiResponse({
    status: 200,
    description: 'Presigned thumbnail upload URL',
    schema: {
      properties: { thumbnail_upload_url: { type: 'string', format: 'uri' } },
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
  async getThumbnailUploadUrl(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const channel = await this.channelsService.findByUserId(user.sub);
    if (!channel) throw new NotFoundException('Channel not found for user');
    return this.videosService.getThumbnailUploadUrl(id, channel.id);
  }

  @Patch(':id/publish')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Publish video',
    description:
      'Marks video as published by setting published_at timestamp. Video must be in ready status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Video published',
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
  @ApiResponse({
    status: 409,
    description: 'Video not ready or already published',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async publishVideo(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const channel = await this.channelsService.findByUserId(user.sub);
    if (!channel) throw new NotFoundException('Channel not found for user');
    return this.videosService.publishVideo(id, channel.id);
  }

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List public ready videos',
    description:
      'Returns a paginated list of public videos with status=ready. Supports search (q), category, and channel filters.',
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
    return { data, total, page: query.page ?? 1, limit: query.limit ?? 20 };
  }

  @Public()
  @Get(':slug/suggestions')
  @ApiOperation({
    summary: 'Get video suggestions',
    description:
      'Returns up to 10 suggested videos from the same category, ordered by view count.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of suggested videos',
    schema: { type: 'array', items: { type: 'object' } },
  })
  async getSuggestions(@Param('slug') slug: string) {
    return this.videosService.getSuggestions(slug);
  }

  @Get(':id/studio')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get own video for studio editing',
    description:
      'Returns a video in any status (draft, processing, ready, error) owned by the authenticated user. Used by the studio edit page.',
  })
  @ApiResponse({
    status: 200,
    description: 'Video details',
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
  async getVideoForStudio(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const channel = await this.channelsService.findByUserId(user.sub);
    if (!channel) throw new NotFoundException('Channel not found for user');
    return this.videosService.findByIdForStudio(id, channel.id);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({
    summary: 'Get video by slug',
    description:
      'Returns a ready video by its unique slug. Works for both public and unlisted videos.',
  })
  @ApiResponse({
    status: 200,
    description: 'Video details',
    schema: { type: 'object' },
  })
  @ApiResponse({
    status: 404,
    description: 'Video not found',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async findBySlug(@Param('slug') slug: string) {
    return this.videosService.findBySlug(slug);
  }

  @Public()
  @Post(':slug/views')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Increment view count',
    description: 'Atomically increments the view count for a ready video.',
  })
  @ApiResponse({ status: 204, description: 'View count incremented' })
  async incrementViewCount(@Param('slug') slug: string): Promise<void> {
    await this.videosService.incrementViewCount(slug);
  }

  @Public()
  @Get(':slug/stream')
  @ApiOperation({
    summary: 'Stream video',
    description:
      'Redirects to a presigned MinIO URL for streaming (supports HTTP Range requests natively).',
  })
  @ApiResponse({ status: 302, description: 'Redirect to presigned stream URL' })
  @ApiResponse({
    status: 404,
    description: 'Video not found',
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
    description: 'Video not found',
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
    description: 'Deletes a video and its associated storage objects.',
  })
  @ApiResponse({ status: 204, description: 'Video deleted' })
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
  async deleteVideo(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<void> {
    const channel = await this.channelsService.findByUserId(user.sub);
    if (!channel) throw new NotFoundException('Channel not found for user');
    await this.videosService.delete(id, channel.id);
  }
}
