import { Video, VideoStatus, VideoVisibility } from './entities/video.entity';
import { VideosService } from './videos.service';
import {
  CategoryNotFoundException,
  VideoAlreadyPublishedException,
  VideoNotFoundException,
  VideoNotInDraftStatusException,
  VideoNotReadyException,
} from '../common/exceptions/domain.exception';
import { VIDEO_PROCESSING_QUEUE } from '../queue/queue.constants';

jest.mock('nanoid', () => ({ nanoid: jest.fn().mockReturnValue('test-slug') }));

const PRESIGNED_UPLOAD_URL = 'https://minio/presigned-put';
const PRESIGNED_DOWNLOAD_URL = 'https://minio/presigned-get';

function makeVideo(overrides: Partial<Video> = {}): Video {
  const v = new Video();
  v.id = 'video-uuid';
  v.channel_id = 'channel-uuid';
  v.category_id = null;
  v.title = 'My Video';
  v.description = null;
  v.status = VideoStatus.DRAFT;
  v.visibility = VideoVisibility.PUBLIC;
  v.storage_key = 'channels/channel-uuid/videos/test-slug/original.mp4';
  v.thumbnail_key = null;
  v.duration = null;
  v.metadata = null;
  v.slug = 'test-slug';
  v.error_message = null;
  v.view_count = 0;
  v.likes_count = 0;
  v.dislikes_count = 0;
  v.comments_count = 0;
  v.published_at = null;
  v.created_at = new Date();
  v.updated_at = new Date();
  return Object.assign(v, overrides);
}

function makeQueryBuilder(overrides: Record<string, jest.Mock> = {}) {
  const qb: Record<string, jest.Mock> = {
    leftJoinAndSelect: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    skip: jest.fn(),
    take: jest.fn(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    update: jest.fn(),
    set: jest.fn(),
    execute: jest.fn().mockResolvedValue(undefined),
    getMany: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
  // make all chainable methods return qb itself
  const chainable = [
    'leftJoinAndSelect',
    'where',
    'andWhere',
    'orderBy',
    'addOrderBy',
    'skip',
    'take',
    'update',
    'set',
  ];
  for (const m of chainable) {
    if (!overrides[m]) qb[m].mockReturnValue(qb);
  }
  return qb;
}

function makeRepo(overrides: Record<string, jest.Mock> = {}): any {
  const qb = makeQueryBuilder();
  return {
    create: jest
      .fn()
      .mockImplementation((data) => Object.assign(new Video(), data)),
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    _qb: qb,
    ...overrides,
  };
}

function makeStorageService(): any {
  return {
    generateUploadPresignedUrl: jest
      .fn()
      .mockResolvedValue(PRESIGNED_UPLOAD_URL),
    generateDownloadPresignedUrl: jest
      .fn()
      .mockResolvedValue(PRESIGNED_DOWNLOAD_URL),
    deleteObject: jest.fn().mockResolvedValue(undefined),
  };
}

function makeCategoriesService(): any {
  return {
    findById: jest.fn(),
    findAll: jest.fn().mockResolvedValue([]),
  };
}

function makeQueue(): any {
  return { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };
}

const mockConfig = {
  endpoint: 'minio',
  port: 9000,
  accessKey: 'key',
  secretKey: 'secret',
  bucket: 'streamtube',
  useSSL: false,
  presignedUrlExpiresIn: 7200,
  publicEndpoint: 'http://localhost:9000',
};

describe('VideosService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let storageService: ReturnType<typeof makeStorageService>;
  let categoriesService: ReturnType<typeof makeCategoriesService>;
  let queue: ReturnType<typeof makeQueue>;
  let service: VideosService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = makeRepo();
    storageService = makeStorageService();
    categoriesService = makeCategoriesService();
    queue = makeQueue();
    service = new VideosService(
      repo,
      storageService,
      categoriesService,
      queue,
      mockConfig,
    );
  });

  describe('initiateUpload', () => {
    it('creates a draft video with the correct storage key and returns a presigned URL', async () => {
      const video = makeVideo();
      repo.save.mockResolvedValue(video);

      const result = await service.initiateUpload('channel-uuid', {
        title: 'My Video',
        content_type: 'video/mp4',
      });

      expect(result.presigned_upload_url).toBe(PRESIGNED_UPLOAD_URL);
      expect(repo.save).toHaveBeenCalledTimes(1);
      const savedVideo = repo.save.mock.calls[0][0] as Video;
      expect(savedVideo.slug).toBe('test-slug');
      expect(savedVideo.storage_key).toMatch(/\/original\.mp4$/);
      expect(savedVideo.status).toBe(VideoStatus.DRAFT);
      expect(storageService.generateUploadPresignedUrl).toHaveBeenCalledWith(
        expect.stringContaining('test-slug'),
        'video/mp4',
        7200,
      );
    });

    it('falls back to .mp4 for unknown content types', async () => {
      repo.save.mockResolvedValue(makeVideo());
      await service.initiateUpload('channel-uuid', {
        title: 'My Video',
        content_type: 'video/unknown',
      });
      const savedVideo = repo.save.mock.calls[0][0] as Video;
      expect(savedVideo.storage_key).toMatch(/\.mp4$/);
    });
  });

  describe('startProcessing', () => {
    it('transitions video to PROCESSING and enqueues a job', async () => {
      const video = makeVideo({ status: VideoStatus.DRAFT });
      repo.findOne.mockResolvedValue(video);
      repo.save.mockResolvedValue({ ...video, status: VideoStatus.PROCESSING });

      const result = await service.startProcessing(
        'video-uuid',
        'channel-uuid',
      );

      expect(result.status).toBe(VideoStatus.PROCESSING);
      expect(repo.save).toHaveBeenCalled();
      expect(queue.add).toHaveBeenCalledWith(
        VIDEO_PROCESSING_QUEUE,
        expect.objectContaining({
          videoId: 'video-uuid',
          channelId: 'channel-uuid',
        }),
        expect.objectContaining({ attempts: 3 }),
      );
    });

    it('throws VideoNotFoundException when video does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.startProcessing('missing-id', 'channel-uuid'),
      ).rejects.toBeInstanceOf(VideoNotFoundException);
    });

    it('throws VideoNotFoundException when video belongs to different channel', async () => {
      const video = makeVideo({ channel_id: 'other-channel' });
      repo.findOne.mockResolvedValue(video);
      await expect(
        service.startProcessing('video-uuid', 'channel-uuid'),
      ).rejects.toBeInstanceOf(VideoNotFoundException);
    });

    it('retries from ERROR state: resets error_message and enqueues a new job', async () => {
      const video = makeVideo({ status: VideoStatus.ERROR, error_message: 'ffprobe failed' });
      repo.findOne.mockResolvedValue(video);
      repo.save.mockResolvedValue({ ...video, status: VideoStatus.PROCESSING, error_message: null });

      const result = await service.startProcessing('video-uuid', 'channel-uuid');

      expect(result.status).toBe(VideoStatus.PROCESSING);
      expect(result.error_message).toBeNull();
      expect(queue.add).toHaveBeenCalledWith(
        VIDEO_PROCESSING_QUEUE,
        expect.objectContaining({ videoId: 'video-uuid' }),
        expect.objectContaining({ attempts: 3 }),
      );
    });

    it('throws VideoNotInDraftStatusException when video is already processing', async () => {
      const video = makeVideo({ status: VideoStatus.PROCESSING });
      repo.findOne.mockResolvedValue(video);
      await expect(
        service.startProcessing('video-uuid', 'channel-uuid'),
      ).rejects.toBeInstanceOf(VideoNotInDraftStatusException);
    });

    it('throws VideoNotInDraftStatusException when video is already ready', async () => {
      const video = makeVideo({ status: VideoStatus.READY });
      repo.findOne.mockResolvedValue(video);
      await expect(
        service.startProcessing('video-uuid', 'channel-uuid'),
      ).rejects.toBeInstanceOf(VideoNotInDraftStatusException);
    });
  });

  describe('updateVideo', () => {
    it('updates title and description', async () => {
      const video = makeVideo({ status: VideoStatus.DRAFT });
      repo.findOne.mockResolvedValue(video);
      repo.save.mockResolvedValue({ ...video, title: 'New Title' });

      const result = await service.updateVideo('video-uuid', 'channel-uuid', {
        title: 'New Title',
      });
      expect(result.title).toBe('New Title');
      expect(repo.save).toHaveBeenCalled();
    });

    it('throws VideoNotFoundException when video not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.updateVideo('missing', 'channel-uuid', {}),
      ).rejects.toBeInstanceOf(VideoNotFoundException);
    });

    it('throws CategoryNotFoundException when category_id does not exist', async () => {
      const video = makeVideo();
      repo.findOne.mockResolvedValue(video);
      categoriesService.findById.mockResolvedValue(null);

      await expect(
        service.updateVideo('video-uuid', 'channel-uuid', {
          category_id: 'bad-cat-id',
        }),
      ).rejects.toBeInstanceOf(CategoryNotFoundException);
    });
  });

  describe('publishVideo', () => {
    it('sets published_at when video is ready and not yet published', async () => {
      const video = makeVideo({
        status: VideoStatus.READY,
        published_at: null,
      });
      repo.findOne.mockResolvedValue(video);
      repo.save.mockImplementation((v: Video) => Promise.resolve(v));

      const result = await service.publishVideo('video-uuid', 'channel-uuid');
      expect(result.published_at).toBeInstanceOf(Date);
    });

    it('throws VideoNotReadyException when video is not ready', async () => {
      const video = makeVideo({
        status: VideoStatus.PROCESSING,
        published_at: null,
      });
      repo.findOne.mockResolvedValue(video);
      await expect(
        service.publishVideo('video-uuid', 'channel-uuid'),
      ).rejects.toBeInstanceOf(VideoNotReadyException);
    });

    it('throws VideoAlreadyPublishedException when already published', async () => {
      const video = makeVideo({
        status: VideoStatus.READY,
        published_at: new Date(),
      });
      repo.findOne.mockResolvedValue(video);
      await expect(
        service.publishVideo('video-uuid', 'channel-uuid'),
      ).rejects.toBeInstanceOf(VideoAlreadyPublishedException);
    });
  });

  describe('findAll', () => {
    it('returns paginated data via query builder', async () => {
      const video = makeVideo({ status: VideoStatus.READY });
      repo._qb.getManyAndCount.mockResolvedValue([[video], 1]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(repo.createQueryBuilder).toHaveBeenCalled();
    });
  });

  describe('findBySlug', () => {
    it('returns a READY video by slug', async () => {
      const video = makeVideo({ status: VideoStatus.READY });
      repo.findOne.mockResolvedValue(video);

      const result = await service.findBySlug('test-slug');

      expect(result).toBe(video);
      expect(repo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug: 'test-slug', status: VideoStatus.READY },
        }),
      );
    });

    it('throws VideoNotFoundException when video is not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findBySlug('missing')).rejects.toBeInstanceOf(
        VideoNotFoundException,
      );
    });
  });

  describe('incrementViewCount', () => {
    it('executes an atomic counter update', async () => {
      await service.incrementViewCount('test-slug');
      expect(repo.createQueryBuilder).toHaveBeenCalled();
      expect(repo._qb.execute).toHaveBeenCalled();
    });
  });

  describe('getStreamUrl', () => {
    it('returns a presigned URL without content-disposition', async () => {
      const video = makeVideo({ status: VideoStatus.READY });
      repo.findOne.mockResolvedValue(video);

      const url = await service.getStreamUrl('test-slug');

      expect(url).toBe(PRESIGNED_DOWNLOAD_URL);
      expect(storageService.generateDownloadPresignedUrl).toHaveBeenCalledWith(
        video.storage_key,
        3600,
      );
    });
  });

  describe('getDownloadUrl', () => {
    it('returns a presigned URL with content-disposition attachment', async () => {
      const video = makeVideo({ status: VideoStatus.READY });
      repo.findOne.mockResolvedValue(video);

      const url = await service.getDownloadUrl('test-slug');

      expect(url).toBe(PRESIGNED_DOWNLOAD_URL);
      expect(storageService.generateDownloadPresignedUrl).toHaveBeenCalledWith(
        video.storage_key,
        3600,
        expect.stringContaining('attachment'),
      );
    });
  });

  describe('delete', () => {
    it('deletes storage objects and removes the entity', async () => {
      const video = makeVideo({
        storage_key: 'channels/channel-uuid/videos/test-slug/original.mp4',
        thumbnail_key: 'channels/channel-uuid/videos/test-slug/thumbnail.jpg',
      });
      repo.findOne.mockResolvedValue(video);
      repo.remove.mockResolvedValue(video);

      await service.delete('video-uuid', 'channel-uuid');

      expect(storageService.deleteObject).toHaveBeenCalledTimes(2);
      expect(repo.remove).toHaveBeenCalledWith(video);
    });

    it('skips storage deletion when storage_key is null', async () => {
      const video = makeVideo({ storage_key: null, thumbnail_key: null });
      repo.findOne.mockResolvedValue(video);
      repo.remove.mockResolvedValue(video);

      await service.delete('video-uuid', 'channel-uuid');

      expect(storageService.deleteObject).not.toHaveBeenCalled();
      expect(repo.remove).toHaveBeenCalledWith(video);
    });

    it('throws VideoNotFoundException when video does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.delete('missing-id', 'channel-uuid'),
      ).rejects.toBeInstanceOf(VideoNotFoundException);
    });
  });
});
