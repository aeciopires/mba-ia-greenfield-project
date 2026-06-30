import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVideos1780000000000 implements MigrationInterface {
  name = 'CreateVideos1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."videos_status_enum" AS ENUM('draft', 'processing', 'ready', 'error')`,
    );
    await queryRunner.query(
      `CREATE TABLE "videos" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "channel_id" uuid NOT NULL,
        "title" character varying(255) NOT NULL,
        "description" text,
        "status" "public"."videos_status_enum" NOT NULL DEFAULT 'draft',
        "storage_key" character varying,
        "thumbnail_key" character varying,
        "duration" integer,
        "metadata" jsonb,
        "slug" character varying NOT NULL,
        "error_message" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_videos_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_videos" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE "videos" ADD CONSTRAINT "FK_videos_channel_id" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_videos_channel_id_status" ON "videos" ("channel_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_videos_status" ON "videos" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_videos_status"`);
    await queryRunner.query(`DROP INDEX "IDX_videos_channel_id_status"`);
    await queryRunner.query(
      `ALTER TABLE "videos" DROP CONSTRAINT "FK_videos_channel_id"`,
    );
    await queryRunner.query(`DROP TABLE "videos"`);
    await queryRunner.query(`DROP TYPE "public"."videos_status_enum"`);
  }
}
