import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
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
import { ChannelsService } from './channels.service';
import { VideosService } from '../videos/videos.service';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { QueryVideosDto } from '../videos/dto/query-videos.dto';

@ApiTags('channels')
@Controller('channels')
export class ChannelsController {
  constructor(
    private readonly channelsService: ChannelsService,
    private readonly videosService: VideosService,
  ) {}

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get own channel',
    description: "Returns the authenticated user's channel.",
  })
  @ApiResponse({
    status: 200,
    description: 'Channel details',
    schema: {
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        nickname: { type: 'string' },
        description: { type: 'string', nullable: true },
        user_id: { type: 'string', format: 'uuid' },
        subscribers_count: { type: 'number' },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
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
    description: 'Channel not found',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async getMyChannel(@CurrentUser() user: JwtPayload) {
    const channel = await this.channelsService.findByUserId(user.sub);
    if (!channel) throw new NotFoundException('Channel not found');
    return channel;
  }

  @Public()
  @Get(':nickname')
  @ApiOperation({
    summary: 'Get public channel',
    description:
      'Returns public channel info including subscriber count and video count.',
  })
  @ApiResponse({
    status: 200,
    description: 'Channel details',
    schema: { type: 'object' },
  })
  @ApiResponse({
    status: 404,
    description: 'Channel not found',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async getChannel(@Param('nickname') nickname: string) {
    const channel = await this.channelsService.findByNickname(nickname);
    if (!channel) throw new NotFoundException('Channel not found');
    return channel;
  }

  @Public()
  @Get(':nickname/videos')
  @ApiOperation({
    summary: 'List channel public videos',
    description: 'Returns paginated public ready videos for a channel.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated channel videos',
    schema: {
      properties: {
        data: { type: 'array', items: { type: 'object' } },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Channel not found',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async getChannelVideos(
    @Param('nickname') nickname: string,
    @Query() query: QueryVideosDto,
  ) {
    const channel = await this.channelsService.findByNickname(nickname);
    if (!channel) throw new NotFoundException('Channel not found');
    const { data, total } = await this.videosService.findChannelVideos(
      channel.id,
      query,
    );
    return { data, total, page: query.page ?? 1, limit: query.limit ?? 20 };
  }

  @Patch(':nickname')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update channel',
    description:
      "Updates the authenticated user's channel name or description.",
  })
  @ApiResponse({
    status: 200,
    description: 'Channel updated',
    schema: { type: 'object' },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 404,
    description: 'Channel not found',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async updateChannel(
    @CurrentUser() user: JwtPayload,
    @Param('nickname') nickname: string,
    @Body() dto: UpdateChannelDto,
  ) {
    return this.channelsService.updateChannel(user.sub, nickname, dto);
  }

  @Get(':nickname/studio/videos')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Studio: list all channel videos',
    description:
      'Returns all videos for the authenticated channel owner (all statuses).',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated channel videos (all statuses)',
    schema: {
      properties: {
        data: { type: 'array', items: { type: 'object' } },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
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
    description: 'Channel not found',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async getStudioVideos(
    @CurrentUser() user: JwtPayload,
    @Param('nickname') nickname: string,
    @Query() query: QueryVideosDto,
  ) {
    const channel = await this.channelsService.findByNickname(nickname);
    if (!channel || channel.user_id !== user.sub) {
      throw new NotFoundException('Channel not found or access denied');
    }
    const { data, total } = await this.videosService.findChannelStudioVideos(
      channel.id,
      query,
    );
    return { data, total, page: query.page ?? 1, limit: query.limit ?? 20 };
  }
}
