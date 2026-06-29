import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => ({
  endpoint: process.env.MINIO_ENDPOINT || 'minio',
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  accessKey: process.env.MINIO_ACCESS_KEY!,
  secretKey: process.env.MINIO_SECRET_KEY!,
  bucket: process.env.MINIO_BUCKET || 'streamtube',
  useSSL: process.env.MINIO_USE_SSL === 'true',
  presignedUrlExpiresIn: parseInt(
    process.env.PRESIGNED_URL_EXPIRES_IN || '7200',
    10,
  ),
  publicEndpoint: process.env.MINIO_PUBLIC_ENDPOINT || 'http://localhost:9000',
}));
