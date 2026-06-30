import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase06SocialFeatures1783000000000 implements MigrationInterface {
  name = 'Phase06SocialFeatures1783000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."vote_type_enum" AS ENUM('like', 'dislike')`,
    );

    await queryRunner.query(
      `CREATE TABLE "video_likes" (
        "user_id" uuid NOT NULL,
        "video_id" uuid NOT NULL,
        "type" "public"."vote_type_enum" NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_video_likes" PRIMARY KEY ("user_id", "video_id")
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE "video_likes"
        ADD CONSTRAINT "FK_video_likes_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        ADD CONSTRAINT "FK_video_likes_video_id" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE`,
    );

    await queryRunner.query(
      `CREATE TABLE "comments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "video_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "parent_id" uuid,
        "content" text NOT NULL,
        "likes_count" integer NOT NULL DEFAULT 0,
        "dislikes_count" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_comments" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_comments_video_id_parent_id" ON "comments" ("video_id", "parent_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments"
        ADD CONSTRAINT "FK_comments_video_id" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE,
        ADD CONSTRAINT "FK_comments_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        ADD CONSTRAINT "FK_comments_parent_id" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE SET NULL`,
    );

    await queryRunner.query(
      `CREATE TABLE "comment_likes" (
        "user_id" uuid NOT NULL,
        "comment_id" uuid NOT NULL,
        "type" "public"."vote_type_enum" NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_comment_likes" PRIMARY KEY ("user_id", "comment_id")
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE "comment_likes"
        ADD CONSTRAINT "FK_comment_likes_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        ADD CONSTRAINT "FK_comment_likes_comment_id" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE`,
    );

    await queryRunner.query(
      `CREATE TABLE "channel_subscriptions" (
        "subscriber_id" uuid NOT NULL,
        "channel_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_channel_subscriptions" PRIMARY KEY ("subscriber_id", "channel_id")
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_subscriptions"
        ADD CONSTRAINT "FK_channel_subscriptions_subscriber_id" FOREIGN KEY ("subscriber_id") REFERENCES "users"("id") ON DELETE CASCADE,
        ADD CONSTRAINT "FK_channel_subscriptions_channel_id" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE`,
    );

    await queryRunner.query(
      `ALTER TABLE "videos"
        ADD COLUMN "likes_count" integer NOT NULL DEFAULT 0,
        ADD COLUMN "dislikes_count" integer NOT NULL DEFAULT 0,
        ADD COLUMN "comments_count" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "channels" ADD COLUMN "subscribers_count" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "channels" DROP COLUMN "subscribers_count"`,
    );
    await queryRunner.query(
      `ALTER TABLE "videos"
        DROP COLUMN "comments_count",
        DROP COLUMN "dislikes_count",
        DROP COLUMN "likes_count"`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_subscriptions"
        DROP CONSTRAINT "FK_channel_subscriptions_channel_id",
        DROP CONSTRAINT "FK_channel_subscriptions_subscriber_id"`,
    );
    await queryRunner.query(`DROP TABLE "channel_subscriptions"`);
    await queryRunner.query(
      `ALTER TABLE "comment_likes"
        DROP CONSTRAINT "FK_comment_likes_comment_id",
        DROP CONSTRAINT "FK_comment_likes_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "comment_likes"`);
    await queryRunner.query(`DROP INDEX "IDX_comments_video_id_parent_id"`);
    await queryRunner.query(
      `ALTER TABLE "comments"
        DROP CONSTRAINT "FK_comments_parent_id",
        DROP CONSTRAINT "FK_comments_user_id",
        DROP CONSTRAINT "FK_comments_video_id"`,
    );
    await queryRunner.query(`DROP TABLE "comments"`);
    await queryRunner.query(
      `ALTER TABLE "video_likes"
        DROP CONSTRAINT "FK_video_likes_video_id",
        DROP CONSTRAINT "FK_video_likes_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "video_likes"`);
    await queryRunner.query(`DROP TYPE "public"."vote_type_enum"`);
  }
}
