import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
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
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('subscriptions')
@Controller()
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post('channels/:nickname/subscriptions')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Subscribe to channel',
    description: 'Subscribes the authenticated user to the specified channel.',
  })
  @ApiResponse({
    status: 201,
    description: 'Subscribed',
    schema: { properties: { subscribers_count: { type: 'number' } } },
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
  @ApiResponse({
    status: 409,
    description: 'Already subscribed',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async subscribe(
    @CurrentUser() user: JwtPayload,
    @Param('nickname') nickname: string,
  ) {
    return this.subscriptionsService.subscribe(user.sub, nickname);
  }

  @Delete('channels/:nickname/subscriptions')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Unsubscribe from channel',
    description:
      "Removes the authenticated user's subscription from the channel.",
  })
  @ApiResponse({
    status: 200,
    description: 'Unsubscribed',
    schema: { properties: { subscribers_count: { type: 'number' } } },
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
  @ApiResponse({
    status: 409,
    description: 'Not subscribed',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @HttpCode(HttpStatus.OK)
  async unsubscribe(
    @CurrentUser() user: JwtPayload,
    @Param('nickname') nickname: string,
  ) {
    return this.subscriptionsService.unsubscribe(user.sub, nickname);
  }

  @Get('users/me/subscriptions')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List my subscriptions',
    description:
      'Returns all channels the authenticated user is subscribed to.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of subscribed channels',
    schema: { type: 'array', items: { type: 'object' } },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async getMySubscriptions(@CurrentUser() user: JwtPayload) {
    return this.subscriptionsService.getUserSubscriptions(user.sub);
  }
}
