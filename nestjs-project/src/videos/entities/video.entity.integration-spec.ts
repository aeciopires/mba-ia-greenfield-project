import { DataSource, Repository } from 'typeorm';
import { RefreshToken } from '../../auth/entities/refresh-token.entity';
import { VerificationToken } from '../../auth/entities/verification-token.entity';
import {
  cleanAllTables,
  createTestDataSource,
} from '../../test/create-test-data-source';
import { User } from '../../users/entities/user.entity';
import { Channel } from '../../channels/entities/channel.entity';
import { Video, VideoStatus } from './video.entity';

const ALL_ENTITIES = [User, Channel, RefreshToken, VerificationToken, Video];

describe('Video entity (integration)', () => {
  let dataSource: DataSource;
  let userRepo: Repository<User>;
  let channelRepo: Repository<Channel>;
  let videoRepo: Repository<Video>;

  let userCounter = 0;

  beforeAll(async () => {
    dataSource = createTestDataSource(ALL_ENTITIES);
    await dataSource.initialize();
    userRepo = dataSource.getRepository(User);
    channelRepo = dataSource.getRepository(Channel);
    videoRepo = dataSource.getRepository(Video);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
  });

  async function createUser(): Promise<User> {
    return userRepo.save(
      userRepo.create({
        email: `vid_user_${++userCounter}@example.com`,
        password: 'hashed',
      }),
    );
  }

  async function createChannel(
    userId: string,
    slug = `chan-${userCounter}`,
  ): Promise<Channel> {
    return channelRepo.save(
      channelRepo.create({
        name: 'Test Channel',
        nickname: slug,
        user_id: userId,
      }),
    );
  }

  async function createVideo(
    channelId: string,
    overrides: Partial<Video> = {},
  ): Promise<Video> {
    return videoRepo.save(
      videoRepo.create({
        channel_id: channelId,
        title: 'Test Video',
        slug: `slug-${Date.now()}-${Math.random()}`,
        storage_key: null,
        status: VideoStatus.DRAFT,
        ...overrides,
      }),
    );
  }

  it('saves a draft video with correct default status', async () => {
    const user = await createUser();
    const channel = await createChannel(user.id);
    const video = await createVideo(channel.id);

    expect(video.id).toBeDefined();
    expect(video.status).toBe(VideoStatus.DRAFT);
    expect(video.duration).toBeNull();
    expect(video.thumbnail_key).toBeNull();
    expect(video.error_message).toBeNull();
  });

  it('enforces unique slug constraint', async () => {
    const user = await createUser();
    const channel = await createChannel(user.id);
    await createVideo(channel.id, { slug: 'duplicate-slug' });

    await expect(
      createVideo(channel.id, { slug: 'duplicate-slug' }),
    ).rejects.toThrow();
  });

  it('cascades delete when channel is removed', async () => {
    const user = await createUser();
    const channel = await createChannel(user.id);
    const video = await createVideo(channel.id);

    await channelRepo.remove(channel);

    const found = await videoRepo.findOne({ where: { id: video.id } });
    expect(found).toBeNull();
  });

  it('allows nullable description', async () => {
    const user = await createUser();
    const channel = await createChannel(user.id);
    const video = await createVideo(channel.id, { description: null });

    expect(video.description).toBeNull();
  });

  it('persists all VideoStatus enum values', async () => {
    const user = await createUser();
    const channel = await createChannel(user.id);

    for (const status of Object.values(VideoStatus)) {
      const video = await createVideo(channel.id, {
        slug: `slug-${status}`,
        status,
      });
      const found = await videoRepo.findOne({ where: { id: video.id } });
      expect(found?.status).toBe(status);
    }
  });

  it('persists duration, metadata and thumbnail_key when set', async () => {
    const user = await createUser();
    const channel = await createChannel(user.id);
    const meta = { codec: 'h264', bitrate: 5000 };
    const video = await createVideo(channel.id, {
      status: VideoStatus.READY,
      duration: 120,
      metadata: meta,
      thumbnail_key: 'channels/c1/thumbnail.jpg',
    });

    const found = await videoRepo.findOne({ where: { id: video.id } });
    expect(found?.duration).toBe(120);
    expect(found?.metadata).toEqual(meta);
    expect(found?.thumbnail_key).toBe('channels/c1/thumbnail.jpg');
  });
});
