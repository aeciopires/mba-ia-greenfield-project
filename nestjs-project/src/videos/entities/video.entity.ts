import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Channel } from '../../channels/entities/channel.entity';
import { Category } from '../../categories/entities/category.entity';

export enum VideoStatus {
  DRAFT = 'draft',
  PROCESSING = 'processing',
  READY = 'ready',
  ERROR = 'error',
}

export enum VideoVisibility {
  PUBLIC = 'public',
  UNLISTED = 'unlisted',
}

@Entity('videos')
export class Video {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  channel_id: string;

  @Column({ type: 'uuid', nullable: true })
  category_id: string | null;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: VideoStatus,
    default: VideoStatus.DRAFT,
  })
  status: VideoStatus;

  @Column({
    type: 'enum',
    enum: VideoVisibility,
    default: VideoVisibility.PUBLIC,
  })
  visibility: VideoVisibility;

  @Column({ type: 'varchar', nullable: true })
  storage_key: string | null;

  @Column({ type: 'varchar', nullable: true })
  thumbnail_key: string | null;

  @Column({ type: 'integer', nullable: true })
  duration: number | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'varchar', unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @Column({ type: 'integer', default: 0 })
  view_count: number;

  @Column({ type: 'integer', default: 0 })
  likes_count: number;

  @Column({ type: 'integer', default: 0 })
  dislikes_count: number;

  @Column({ type: 'integer', default: 0 })
  comments_count: number;

  @Column({ type: 'timestamp', nullable: true })
  published_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Channel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channel_id' })
  channel: Channel;

  @ManyToOne(() => Category, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category: Category | null;
}
