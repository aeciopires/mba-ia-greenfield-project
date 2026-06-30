import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Channel } from '../channels/entities/channel.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { VerificationToken } from '../auth/entities/verification-token.entity';
import { Video } from '../videos/entities/video.entity';
import { Category } from '../categories/entities/category.entity';
import { Comment } from '../social/comments/comment.entity';
import { CommentLike } from '../social/comment-likes/comment-like.entity';
import { VideoLike } from '../social/video-likes/video-like.entity';
import { ChannelSubscription } from '../social/subscriptions/channel-subscription.entity';
import { CreateUsersAndChannels1775687773260 } from './migrations/1775687773260-CreateUsersAndChannels';
import { CreateAuthTokens1777579850478 } from './migrations/1777579850478-CreateAuthTokens';
import { CreateVideos1780000000000 } from './migrations/1780000000000-CreateVideos';
import { Phase04VideoManagement1781000000000 } from './migrations/1781000000000-Phase04VideoManagement';
import { Phase05ViewCount1782000000000 } from './migrations/1782000000000-Phase05ViewCount';
import { Phase06SocialFeatures1783000000000 } from './migrations/1783000000000-Phase06SocialFeatures';
import { createTestDataSource } from '../test/create-test-data-source';

const ALL_ENTITIES = [
  User,
  Channel,
  RefreshToken,
  VerificationToken,
  Video,
  Category,
  Comment,
  CommentLike,
  VideoLike,
  ChannelSubscription,
];

const ALL_MIGRATIONS = [
  CreateUsersAndChannels1775687773260,
  CreateAuthTokens1777579850478,
  CreateVideos1780000000000,
  Phase04VideoManagement1781000000000,
  Phase05ViewCount1782000000000,
  Phase06SocialFeatures1783000000000,
];

const MANAGED_TABLES = [
  'channel_subscriptions',
  'comment_likes',
  'comments',
  'video_likes',
  'categories',
  'videos',
  'channels',
  'refresh_tokens',
  'verification_tokens',
  'users',
];

const MANAGED_ENUMS = [
  '"public"."videos_status_enum"',
  '"public"."verification_tokens_type_enum"',
  '"public"."videos_visibility_enum"',
  '"public"."vote_type_enum"',
];

describe('Database migrations (integration)', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = createTestDataSource(ALL_ENTITIES, {
      synchronize: false,
      migrations: ALL_MIGRATIONS,
    });

    await dataSource.initialize();

    for (const table of MANAGED_TABLES) {
      await dataSource.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    }
    await dataSource.query(`DROP TABLE IF EXISTS "migrations" CASCADE`);
    for (const enumType of MANAGED_ENUMS) {
      await dataSource.query(`DROP TYPE IF EXISTS ${enumType} CASCADE`);
    }
  });

  afterAll(async () => {
    // Re-apply all migrations to leave the shared DB fully migrated for subsequent suites.
    await dataSource.runMigrations();
    await dataSource.destroy();
  });

  it('should apply all migrations and create all expected tables', async () => {
    const ranMigrations = await dataSource.runMigrations();

    expect(ranMigrations).toHaveLength(6);

    const expectedTables = [
      'categories',
      'channel_subscriptions',
      'channels',
      'comment_likes',
      'comments',
      'refresh_tokens',
      'users',
      'verification_tokens',
      'video_likes',
      'videos',
    ];

    const result = await dataSource.query<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])
       ORDER BY table_name`,
      [expectedTables],
    );
    const tableNames = result.map((r) => r.table_name);
    expect(tableNames).toEqual(expectedTables);
  });

  it('should revert the last migration and remove the social tables', async () => {
    await dataSource.undoLastMigration();

    const socialTables = [
      'video_likes',
      'comment_likes',
      'comments',
      'channel_subscriptions',
    ];
    const socialResult = await dataSource.query<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])`,
      [socialTables],
    );
    expect(socialResult).toHaveLength(0);

    const tokenResult = await dataSource.query<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])`,
      [['refresh_tokens', 'verification_tokens']],
    );
    expect(tokenResult).toHaveLength(2);
  });
});
