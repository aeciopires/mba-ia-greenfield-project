import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageService } from './storage.service';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

// Represents the URL the presign client (configured with publicEndpoint) generates.
const PRESIGNED_URL =
  'http://localhost:9000/streamtube/channels/c1/videos/v1/original.mp4?X-Amz-Signature=abc';

const DEFAULT_CONFIG = {
  endpoint: 'minio',
  port: 9000,
  accessKey: 'key',
  secretKey: 'secret',
  bucket: 'streamtube',
  useSSL: false,
  presignedUrlExpiresIn: 7200,
  publicEndpoint: 'http://localhost:9000',
};

function makeS3Client(
  sendFn: jest.Mock = jest.fn().mockResolvedValue({}),
): any {
  return { send: sendFn };
}

describe('StorageService', () => {
  let mockSend: jest.Mock;
  let service: StorageService;

  beforeEach(() => {
    jest.clearAllMocks();
    (getSignedUrl as jest.Mock).mockResolvedValue(PRESIGNED_URL);
    mockSend = jest.fn().mockResolvedValue({});
    service = new StorageService(makeS3Client(mockSend), DEFAULT_CONFIG);
  });

  describe('generateUploadPresignedUrl', () => {
    it('returns the presigned URL from the public-endpoint client', async () => {
      const url = await service.generateUploadPresignedUrl(
        'key/video.mp4',
        'video/mp4',
      );
      expect(url).toBe(PRESIGNED_URL);
    });

    it('uses config default expiry', async () => {
      await service.generateUploadPresignedUrl('key/video.mp4', 'video/mp4');
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        { expiresIn: 7200 },
      );
    });

    it('uses provided expiresIn instead of config default', async () => {
      await service.generateUploadPresignedUrl('key/video.mp4', 'video/mp4', 3600);
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        { expiresIn: 3600 },
      );
    });
  });

  describe('generateDownloadPresignedUrl', () => {
    it('returns the presigned URL from the public-endpoint client', async () => {
      const url = await service.generateDownloadPresignedUrl('key/video.mp4');
      expect(url).toBe(PRESIGNED_URL);
      expect(getSignedUrl).toHaveBeenCalledTimes(1);
    });

    it('passes content-disposition when provided', async () => {
      await service.generateDownloadPresignedUrl(
        'key/video.mp4',
        3600,
        'attachment; filename="video.mp4"',
      );
      const [, command] = (getSignedUrl as jest.Mock).mock.calls[0] as [
        unknown,
        { input: Record<string, unknown> },
      ];
      expect(command.input['ResponseContentDisposition']).toBe(
        'attachment; filename="video.mp4"',
      );
    });

    it('does not include content-disposition when not provided', async () => {
      await service.generateDownloadPresignedUrl('key/video.mp4');
      const [, command] = (getSignedUrl as jest.Mock).mock.calls[0] as [
        unknown,
        { input: Record<string, unknown> },
      ];
      expect(command.input['ResponseContentDisposition']).toBeUndefined();
    });
  });

  describe('putObject', () => {
    it('sends a PutObjectCommand with the correct key and content type', async () => {
      const body = Buffer.from('thumbnail');
      await service.putObject('channels/c1/thumbnail.jpg', body, 'image/jpeg');
      expect(mockSend).toHaveBeenCalledTimes(1);
      const [command] = mockSend.mock.calls[0] as [
        { input: Record<string, unknown> },
      ];
      expect(command.input['Key']).toBe('channels/c1/thumbnail.jpg');
      expect(command.input['ContentType']).toBe('image/jpeg');
      expect(command.input['Body']).toBe(body);
    });
  });

  describe('deleteObject', () => {
    it('sends a DeleteObjectCommand for the given key', async () => {
      await service.deleteObject('channels/c1/video.mp4');
      expect(mockSend).toHaveBeenCalledTimes(1);
      const [command] = mockSend.mock.calls[0] as [
        { input: Record<string, unknown> },
      ];
      expect(command.input['Key']).toBe('channels/c1/video.mp4');
    });
  });

  describe('ensureBucketExists', () => {
    it('does nothing when the bucket already exists (HeadBucket succeeds)', async () => {
      await service.ensureBucketExists();
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('creates the bucket when NoSuchBucket is returned', async () => {
      const err = Object.assign(new Error(), { name: 'NoSuchBucket' });
      mockSend.mockRejectedValueOnce(err).mockResolvedValueOnce({});
      await service.ensureBucketExists();
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('creates the bucket when NotFound is returned', async () => {
      const err = Object.assign(new Error(), { name: 'NotFound' });
      mockSend.mockRejectedValueOnce(err).mockResolvedValueOnce({});
      await service.ensureBucketExists();
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('rethrows unexpected errors', async () => {
      const err = new Error('Connection refused');
      mockSend.mockRejectedValue(err);
      await expect(service.ensureBucketExists()).rejects.toThrow(
        'Connection refused',
      );
    });
  });
});
