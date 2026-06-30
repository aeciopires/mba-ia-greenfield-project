import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { StorageService } from './storage.service';

const config = {
  endpoint: process.env.MINIO_ENDPOINT ?? 'minio',
  port: parseInt(process.env.MINIO_PORT ?? '9000', 10),
  accessKey: process.env.MINIO_ACCESS_KEY ?? 'streamtube',
  secretKey: process.env.MINIO_SECRET_KEY ?? 'streamtube',
  bucket: process.env.MINIO_BUCKET ?? 'streamtube-test',
  useSSL: false,
  presignedUrlExpiresIn: 3600,
  publicEndpoint: `http://${process.env.MINIO_ENDPOINT ?? 'minio'}:9000`,
};

function makeS3Client(): S3Client {
  return new S3Client({
    endpoint: `http://${config.endpoint}:${config.port}`,
    region: 'us-east-1',
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
    forcePathStyle: true,
  });
}

const TEST_KEY = `integration-test/test-file-${Date.now()}.txt`;
const TEST_CONTENT = Buffer.from('hello from integration test');

describe('StorageService (integration)', () => {
  let service: StorageService;
  let s3Client: S3Client;

  beforeAll(async () => {
    s3Client = makeS3Client();
    service = new StorageService(s3Client, config);
    await service.ensureBucketExists();
  });

  afterAll(async () => {
    try {
      await service.deleteObject(TEST_KEY);
    } catch {
      // test cleanup — ignore if already deleted
    }
    s3Client.destroy();
  });

  it('ensures bucket exists without throwing', async () => {
    await expect(service.ensureBucketExists()).resolves.toBeUndefined();
  });

  it('putObject uploads a buffer and object is retrievable', async () => {
    await service.putObject(TEST_KEY, TEST_CONTENT, 'text/plain');

    await expect(
      s3Client.send(
        new HeadObjectCommand({ Bucket: config.bucket, Key: TEST_KEY }),
      ),
    ).resolves.toBeDefined();
  });

  it('generateUploadPresignedUrl returns a URL string', async () => {
    const url = await service.generateUploadPresignedUrl(
      `integration-test/upload-${Date.now()}.mp4`,
      'video/mp4',
    );
    expect(typeof url).toBe('string');
    expect(url).toMatch(/^https?:\/\//);
  });

  it('generateDownloadPresignedUrl returns a URL that serves the object', async () => {
    const url = await service.generateDownloadPresignedUrl(TEST_KEY, 60);

    expect(url).toMatch(/^https?:\/\//);

    const response = await fetch(url);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toBe(TEST_CONTENT.toString());
  });

  it('generateDownloadPresignedUrl with content-disposition returns URL with attachment header', async () => {
    const url = await service.generateDownloadPresignedUrl(
      TEST_KEY,
      60,
      'attachment; filename="test.txt"',
    );
    expect(url).toContain('response-content-disposition');
  });

  it('deleteObject removes the object', async () => {
    const deleteKey = `integration-test/to-delete-${Date.now()}.txt`;
    await service.putObject(deleteKey, Buffer.from('bye'), 'text/plain');
    await service.deleteObject(deleteKey);

    await expect(
      s3Client.send(
        new HeadObjectCommand({ Bucket: config.bucket, Key: deleteKey }),
      ),
    ).rejects.toMatchObject({
      name: expect.stringMatching(/NotFound|NoSuchKey/),
    });
  });
});
