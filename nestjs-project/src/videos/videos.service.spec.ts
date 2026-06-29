import { Video, VideoStatus } from './entities/video.entity';
import { VideosService } from './videos.service';
import {
  VideoNotFoundException,
  VideoNotInDraftStatusException,
} from '../common/exceptions/domain.exception';
import { VIDEO_PROCESSING_QUEUE } from '../queue/queue.constants';

jest.mock('nanoid', () => ({ nanoid: jest.fn().mockReturnValue('test-slug') }));

const PRESIGNED_UPLOAD_URL = 'https://minio/presigned-put';
const PRESIGNED_DOWNLOAD_URL = 'https://minio/presigned-get';

function makeVideo(overrides: Partial<Video> = {}): Video {
  const v = new Video();
  v.id = 'video-uuid';
  v.channel_id = 'channel-uuid';
  v.title = 'My Video';
  v.description = null;
  v.status = VideoStatus.DRAFT;
  v.storage_key = 'channels/channel-uuid/videos/test-slug/original.mp4';
  v.thumbnail_key = null;
  v.duration = null;
  v.metadata = null;
  v.slug = 'test-slug';
  v.error_message = null;
  v.created_at = new Date();
  v.updated_at = new Date();
  return Object.assign(v, overrides);
}

function makeRepo(overrides: Record<string, jest.Mock> = {}): any {
  return {
    create: jest
      .fn()
      .mockImplementation((data) => Object.assign(new Video(), data)),
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    remove: jest.fn(),
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
  let queue: ReturnType<typeof makeQueue>;
  let service: VideosService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = makeRepo();
    storageService = makeStorageService();
    queue = makeQueue();
    service = new VideosService(repo, storageService, queue, mockConfig);
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

    it('throws VideoNotInDraftStatusException when video is already processing', async () => {
      const video = makeVideo({ status: VideoStatus.PROCESSING });
      repo.findOne.mockResolvedValue(video);
      await expect(
        service.startProcessing('video-uuid', 'channel-uuid'),
      ).rejects.toBeInstanceOf(VideoNotInDraftStatusException);
    });
  });

  describe('findAll', () => {
    it('returns paginated data for READY videos', async () => {
      const videos = [makeVideo({ status: VideoStatus.READY })];
      repo.findAndCount.mockResolvedValue([videos, 1]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: VideoStatus.READY },
          skip: 0,
          take: 20,
        }),
      );
    });
  });

  describe('findBySlug', () => {
    it('returns a READY video by slug', async () => {
      const video = makeVideo({ status: VideoStatus.READY });
      repo.findOne.mockResolvedValue(video);

      const result = await service.findBySlug('test-slug');

      expect(result).toBe(video);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { slug: 'test-slug', status: VideoStatus.READY },
      });
    });

    it('throws VideoNotFoundException when video is not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findBySlug('missing')).rejects.toBeInstanceOf(
        VideoNotFoundException,
      );
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
