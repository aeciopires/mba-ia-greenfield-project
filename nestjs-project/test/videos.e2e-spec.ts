import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { ValidationExceptionFilter } from '../src/common/filters/validation-exception.filter';
import { Video, VideoStatus } from '../src/videos/entities/video.entity';
import { cleanAllTables } from '../src/test/create-test-data-source';

describe('Videos (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let videoRepository: Repository<Video>;
  let throttlerStorage: ThrottlerStorageService;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(
      new DomainExceptionFilter(),
      new ValidationExceptionFilter(),
    );
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    videoRepository = dataSource.getRepository(Video);
    throttlerStorage =
      moduleFixture.get<ThrottlerStorageService>(ThrottlerStorage);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
    throttlerStorage.storage.clear();
  });

  async function captureConfirmationToken(
    email: string,
    password = 'password123',
  ): Promise<string> {
    const authService = app.get(AuthService);
    const mailServiceInstance = (authService as any).mailService;
    let capturedToken = '';
    jest
      .spyOn(mailServiceInstance, 'sendConfirmationEmail')
      .mockImplementationOnce(async (_e: string, _n: string, t: string) => {
        capturedToken = t;
      });
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password });
    return capturedToken;
  }

  async function registerConfirmAndLogin(
    email: string,
    password = 'password123',
  ): Promise<{ access_token: string }> {
    const token = await captureConfirmationToken(email, password);
    await request(app.getHttpServer())
      .get('/auth/confirm-email')
      .query({ token });
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password });
    return { access_token: res.body.access_token };
  }

  describe('POST /videos', () => {
    it('returns 201 with draft video and presigned upload URL', async () => {
      const { access_token } =
        await registerConfirmAndLogin('vid1@example.com');

      const res = await request(app.getHttpServer())
        .post('/videos')
        .set('Authorization', `Bearer ${access_token}`)
        .send({ title: 'My Test Video', content_type: 'video/mp4' })
        .expect(201);

      expect(res.body.video).toBeDefined();
      expect(res.body.video.status).toBe('draft');
      expect(res.body.video.slug).toBeDefined();
      expect(res.body.presigned_upload_url).toMatch(/^https?:\/\//);
    });

    it('returns 401 when no token is provided', async () => {
      await request(app.getHttpServer())
        .post('/videos')
        .send({ title: 'Test', content_type: 'video/mp4' })
        .expect(401);
    });

    it('returns 400 when title is missing', async () => {
      const { access_token } =
        await registerConfirmAndLogin('vid2@example.com');

      const res = await request(app.getHttpServer())
        .post('/videos')
        .set('Authorization', `Bearer ${access_token}`)
        .send({ content_type: 'video/mp4' })
        .expect(400);

      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('PATCH /videos/:id/start-processing', () => {
    it('transitions video to processing status', async () => {
      const { access_token } =
        await registerConfirmAndLogin('vid3@example.com');

      const postRes = await request(app.getHttpServer())
        .post('/videos')
        .set('Authorization', `Bearer ${access_token}`)
        .send({ title: 'My Video', content_type: 'video/mp4' })
        .expect(201);

      const videoId = postRes.body.video.id;

      const patchRes = await request(app.getHttpServer())
        .patch(`/videos/${videoId}/start-processing`)
        .set('Authorization', `Bearer ${access_token}`)
        .expect(200);

      expect(patchRes.body.status).toBe('processing');
    });

    it('returns 409 when called twice (video not in draft)', async () => {
      const { access_token } =
        await registerConfirmAndLogin('vid4@example.com');

      const postRes = await request(app.getHttpServer())
        .post('/videos')
        .set('Authorization', `Bearer ${access_token}`)
        .send({ title: 'Video', content_type: 'video/mp4' })
        .expect(201);

      const videoId = postRes.body.video.id;

      await request(app.getHttpServer())
        .patch(`/videos/${videoId}/start-processing`)
        .set('Authorization', `Bearer ${access_token}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .patch(`/videos/${videoId}/start-processing`)
        .set('Authorization', `Bearer ${access_token}`)
        .expect(409);

      expect(res.body.error).toBe('VIDEO_NOT_IN_DRAFT_STATUS');
    });

    it('returns 404 for a video belonging to another user', async () => {
      const { access_token: tokenA } =
        await registerConfirmAndLogin('vid5a@example.com');
      const { access_token: tokenB } =
        await registerConfirmAndLogin('vid5b@example.com');

      const postRes = await request(app.getHttpServer())
        .post('/videos')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: 'Video A', content_type: 'video/mp4' })
        .expect(201);

      const videoId = postRes.body.video.id;

      const res = await request(app.getHttpServer())
        .patch(`/videos/${videoId}/start-processing`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404);

      expect(res.body.error).toBe('VIDEO_NOT_FOUND');
    });
  });

  describe('GET /videos (public)', () => {
    it('returns empty list when no ready videos exist', async () => {
      const res = await request(app.getHttpServer()).get('/videos').expect(200);

      expect(res.body.data).toHaveLength(0);
      expect(res.body.total).toBe(0);
    });

    it('returns only ready videos with pagination', async () => {
      const { access_token } =
        await registerConfirmAndLogin('vid6@example.com');

      const postRes = await request(app.getHttpServer())
        .post('/videos')
        .set('Authorization', `Bearer ${access_token}`)
        .send({ title: 'Ready Video', content_type: 'video/mp4' })
        .expect(201);

      const videoId = postRes.body.video.id;

      await videoRepository.update(videoId, {
        status: VideoStatus.READY,
        storage_key: `channels/ch1/videos/${postRes.body.video.slug}/original.mp4`,
      });

      const res = await request(app.getHttpServer()).get('/videos').expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
      expect(res.body.data[0].title).toBe('Ready Video');
    });
  });

  describe('GET /videos/:slug (public)', () => {
    it('returns 404 for unknown slug', async () => {
      const res = await request(app.getHttpServer())
        .get('/videos/no-such-slug')
        .expect(404);

      expect(res.body.error).toBe('VIDEO_NOT_FOUND');
    });

    it('returns video details for a ready video', async () => {
      const { access_token } =
        await registerConfirmAndLogin('vid7@example.com');

      const postRes = await request(app.getHttpServer())
        .post('/videos')
        .set('Authorization', `Bearer ${access_token}`)
        .send({ title: 'Slug Video', content_type: 'video/mp4' })
        .expect(201);

      const { id, slug } = postRes.body.video;
      await videoRepository.update(id, {
        status: VideoStatus.READY,
        storage_key: `channels/ch1/videos/${slug}/original.mp4`,
      });

      const res = await request(app.getHttpServer())
        .get(`/videos/${slug}`)
        .expect(200);

      expect(res.body.slug).toBe(slug);
      expect(res.body.title).toBe('Slug Video');
    });
  });

  describe('GET /videos/:slug/stream and /download (public)', () => {
    it('returns 302 redirect for stream endpoint', async () => {
      const { access_token } =
        await registerConfirmAndLogin('vid8@example.com');

      const postRes = await request(app.getHttpServer())
        .post('/videos')
        .set('Authorization', `Bearer ${access_token}`)
        .send({ title: 'Stream Video', content_type: 'video/mp4' })
        .expect(201);

      const { id, slug } = postRes.body.video;
      await videoRepository.update(id, {
        status: VideoStatus.READY,
        storage_key: `channels/ch1/videos/${slug}/original.mp4`,
      });

      await request(app.getHttpServer())
        .get(`/videos/${slug}/stream`)
        .redirects(0)
        .expect(302);
    });

    it('returns 302 redirect with attachment disposition for download endpoint', async () => {
      const { access_token } =
        await registerConfirmAndLogin('vid9@example.com');

      const postRes = await request(app.getHttpServer())
        .post('/videos')
        .set('Authorization', `Bearer ${access_token}`)
        .send({ title: 'Download Video', content_type: 'video/mp4' })
        .expect(201);

      const { id, slug } = postRes.body.video;
      await videoRepository.update(id, {
        status: VideoStatus.READY,
        storage_key: `channels/ch1/videos/${slug}/original.mp4`,
      });

      const res = await request(app.getHttpServer())
        .get(`/videos/${slug}/download`)
        .redirects(0)
        .expect(302);

      expect(res.headers['location']).toContain('attachment');
    });
  });

  describe('DELETE /videos/:id', () => {
    it('returns 204 and removes the video', async () => {
      const { access_token } =
        await registerConfirmAndLogin('vid10@example.com');

      const postRes = await request(app.getHttpServer())
        .post('/videos')
        .set('Authorization', `Bearer ${access_token}`)
        .send({ title: 'To Delete', content_type: 'video/mp4' })
        .expect(201);

      const videoId = postRes.body.video.id;

      await request(app.getHttpServer())
        .delete(`/videos/${videoId}`)
        .set('Authorization', `Bearer ${access_token}`)
        .expect(204);

      const found = await videoRepository.findOne({ where: { id: videoId } });
      expect(found).toBeNull();
    });

    it('returns 401 when unauthenticated', async () => {
      await request(app.getHttpServer()).delete('/videos/some-id').expect(401);
    });

    it("returns 404 when trying to delete another user's video", async () => {
      const { access_token: tokenA } =
        await registerConfirmAndLogin('vid11a@example.com');
      const { access_token: tokenB } =
        await registerConfirmAndLogin('vid11b@example.com');

      const postRes = await request(app.getHttpServer())
        .post('/videos')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: 'User A Video', content_type: 'video/mp4' })
        .expect(201);

      const videoId = postRes.body.video.id;

      const res = await request(app.getHttpServer())
        .delete(`/videos/${videoId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404);

      expect(res.body.error).toBe('VIDEO_NOT_FOUND');
    });
  });
});
