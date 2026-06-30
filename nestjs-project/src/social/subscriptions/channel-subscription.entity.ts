import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Channel } from '../../channels/entities/channel.entity';

@Entity('channel_subscriptions')
export class ChannelSubscription {
  @PrimaryColumn({ type: 'uuid' })
  subscriber_id: string;

  @PrimaryColumn({ type: 'uuid' })
  channel_id: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subscriber_id' })
  subscriber: User;

  @ManyToOne(() => Channel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channel_id' })
  channel: Channel;
}
