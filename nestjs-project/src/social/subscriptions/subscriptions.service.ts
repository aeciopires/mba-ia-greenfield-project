import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChannelSubscription } from './channel-subscription.entity';
import { Channel } from '../../channels/entities/channel.entity';
import {
  AlreadySubscribedException,
  ChannelNotFoundException,
  NotSubscribedException,
} from '../../common/exceptions/domain.exception';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(ChannelSubscription)
    private readonly subscriptionRepository: Repository<ChannelSubscription>,
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
  ) {}

  async subscribe(
    subscriberId: string,
    channelNickname: string,
  ): Promise<{ subscribers_count: number }> {
    const channel = await this.channelRepository.findOne({
      where: { nickname: channelNickname },
    });
    if (!channel) throw new ChannelNotFoundException();

    const existing = await this.subscriptionRepository.findOne({
      where: { subscriber_id: subscriberId, channel_id: channel.id },
    });
    if (existing) throw new AlreadySubscribedException();

    await this.subscriptionRepository.save(
      this.subscriptionRepository.create({
        subscriber_id: subscriberId,
        channel_id: channel.id,
      }),
    );

    await this.channelRepository
      .createQueryBuilder()
      .update(Channel)
      .set({ subscribers_count: () => 'subscribers_count + 1' })
      .where('id = :id', { id: channel.id })
      .execute();

    const updated = await this.channelRepository.findOne({
      where: { id: channel.id },
    });
    return { subscribers_count: updated!.subscribers_count };
  }

  async unsubscribe(
    subscriberId: string,
    channelNickname: string,
  ): Promise<{ subscribers_count: number }> {
    const channel = await this.channelRepository.findOne({
      where: { nickname: channelNickname },
    });
    if (!channel) throw new ChannelNotFoundException();

    const existing = await this.subscriptionRepository.findOne({
      where: { subscriber_id: subscriberId, channel_id: channel.id },
    });
    if (!existing) throw new NotSubscribedException();

    await this.subscriptionRepository.delete({
      subscriber_id: subscriberId,
      channel_id: channel.id,
    });

    await this.channelRepository
      .createQueryBuilder()
      .update(Channel)
      .set({ subscribers_count: () => 'GREATEST(subscribers_count - 1, 0)' })
      .where('id = :id', { id: channel.id })
      .execute();

    const updated = await this.channelRepository.findOne({
      where: { id: channel.id },
    });
    return { subscribers_count: updated!.subscribers_count };
  }

  async getUserSubscriptions(userId: string): Promise<Channel[]> {
    const subscriptions = await this.subscriptionRepository.find({
      where: { subscriber_id: userId },
      relations: ['channel'],
      order: { created_at: 'DESC' },
    });
    return subscriptions.map((s) => s.channel);
  }
}
