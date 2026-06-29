import * as fs from 'node:fs';
import { Video, VideoStatus } from '../entities/video.entity';
import { VideoProcessingProcessor } from './video-processing.processor';

jest.mock('node:fs');

const PRESIGNED_URL = 'https://minio/signed-url';
const VIDEO_ID = 'video-uuid';
const STORAGE_KEY = 'channels/ch1/videos/slug1/original.mp4';

function makeVideo(overrides: Partial<Video> = {}): Video {
  const v = new Video();
  v.id = VIDEO_ID;
  v.channel_id = 'ch1';
  v.status = VideoStatus.PROCESSING;
  v.storage_key = STORAGE_KEY;
  v.thumbnail_key = null;
  v.duration = null;
  v.metadata = null;
  v.slug = 'slug1';
  v.title = 'Test';
  return Object.assign(v, overrides);
}

function makeRepo(): any {
  return {
    findOne: jest.fn().mockResolvedValue(makeVideo()),
    findOneBy: jest.fn().mockResolvedValue(makeVideo()),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    save: jest.fn().mockImplementation((v) => Promise.resolve(v)),
  };
}

function makeStorageService(): any {
  return {
    generateDownloadPresignedUrl: jest.fn().mockResolvedValue(PRESIGNED_URL),
    putObject: jest.fn().mockResolvedValue(undefined),
  };
}

function makeJob(data = {}): any {
  return {
    data: {
      videoId: VIDEO_ID,
      channelId: 'ch1',
      storageKey: STORAGE_KEY,
      ...data,
    },
  };
}

describe('VideoProcessingProcessor', () => {
  let repo: ReturnType<typeof makeRepo>;
  let storageService: ReturnType<typeof makeStorageService>;
  let processor: VideoProcessingProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(fs.readFileSync).mockReturnValue(Buffer.from(''));
    jest.mocked(fs.unlinkSync).mockReturnValue(undefined);
    repo = makeRepo();
    storageService = makeStorageService();
    processor = new VideoProcessingProcessor(repo, storageService);
  });

  describe('process', () => {
    it('marks video as READY with duration and thumbnail when all steps succeed', async () => {
      const probeResult = { format: { duration: 100, size: 1024 } };
      jest.spyOn(processor as any, 'probeVideo').mockResolvedValue(probeResult);
      jest
        .spyOn(processor as any, 'generateThumbnail')
        .mockResolvedValue(undefined);
      jest.mocked(fs.readFileSync).mockReturnValue(Buffer.from('img'));

      await processor.process(makeJob());

      const savedVideo = repo.save.mock.calls[0][0] as Video;
      expect(savedVideo.status).toBe(VideoStatus.READY);
      expect(savedVideo.duration).toBe(100);
      expect(savedVideo.thumbnail_key).toContain('thumbnail.jpg');
      expect(savedVideo.error_message).toBeNull();
      expect(storageService.putObject).toHaveBeenCalledWith(
        expect.stringContaining('thumbnail.jpg'),
        expect.any(Buffer),
        'image/jpeg',
      );
    });

    it('uses seek of 1s when duration is 10s or less', async () => {
      const generateThumbnailSpy = jest
        .spyOn(processor as any, 'generateThumbnail')
        .mockResolvedValue(undefined);
      jest
        .spyOn(processor as any, 'probeVideo')
        .mockResolvedValue({ format: { duration: 5 } });

      await processor.process(makeJob());

      expect(generateThumbnailSpy).toHaveBeenCalledWith(
        PRESIGNED_URL,
        1,
        expect.any(String),
      );
    });

    it('uses seek at 10% of duration when duration is above 10s', async () => {
      const generateThumbnailSpy = jest
        .spyOn(processor as any, 'generateThumbnail')
        .mockResolvedValue(undefined);
      jest
        .spyOn(processor as any, 'probeVideo')
        .mockResolvedValue({ format: { duration: 200 } });

      await processor.process(makeJob());

      expect(generateThumbnailSpy).toHaveBeenCalledWith(
        PRESIGNED_URL,
        20,
        expect.any(String),
      );
    });

    it('marks video as ERROR and stores the message when processing fails', async () => {
      jest
        .spyOn(processor as any, 'probeVideo')
        .mockRejectedValue(new Error('ffprobe failed'));

      await processor.process(makeJob());

      expect(repo.update).toHaveBeenCalledWith(
        VIDEO_ID,
        expect.objectContaining({
          status: VideoStatus.ERROR,
          error_message: 'ffprobe failed',
        }),
      );
      expect(storageService.putObject).not.toHaveBeenCalled();
    });

    it('marks video as ERROR when thumbnail upload fails', async () => {
      jest
        .spyOn(processor as any, 'probeVideo')
        .mockResolvedValue({ format: { duration: 100 } });
      jest
        .spyOn(processor as any, 'generateThumbnail')
        .mockResolvedValue(undefined);
      storageService.putObject.mockRejectedValue(new Error('upload failed'));

      await processor.process(makeJob());

      expect(repo.update).toHaveBeenCalledWith(
        VIDEO_ID,
        expect.objectContaining({
          status: VideoStatus.ERROR,
          error_message: 'upload failed',
        }),
      );
    });

    it('derives thumbnail key from the storage key directory', async () => {
      jest
        .spyOn(processor as any, 'probeVideo')
        .mockResolvedValue({ format: { duration: 60 } });
      jest
        .spyOn(processor as any, 'generateThumbnail')
        .mockResolvedValue(undefined);

      await processor.process(makeJob());

      const savedVideo = repo.save.mock.calls[0][0] as Video;
      expect(savedVideo.thumbnail_key).toBe(
        'channels/ch1/videos/slug1/thumbnail.jpg',
      );
      const [thumbnailKey] = storageService.putObject.mock.calls[0] as [string];
      expect(thumbnailKey).toBe('channels/ch1/videos/slug1/thumbnail.jpg');
    });
  });
});
