import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase04VideoManagement1781000000000 implements MigrationInterface {
  name = 'Phase04VideoManagement1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(100) NOT NULL,
        "slug" character varying(100) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_categories_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_categories" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."videos_visibility_enum" AS ENUM('public', 'unlisted')`,
    );

    await queryRunner.query(
      `ALTER TABLE "videos"
        ADD COLUMN "category_id" uuid,
        ADD COLUMN "visibility" "public"."videos_visibility_enum" NOT NULL DEFAULT 'public',
        ADD COLUMN "published_at" TIMESTAMP`,
    );

    await queryRunner.query(
      `ALTER TABLE "videos" ADD CONSTRAINT "FK_videos_category_id" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_videos_category_id" ON "videos" ("category_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_videos_category_id"`);
    await queryRunner.query(
      `ALTER TABLE "videos" DROP CONSTRAINT "FK_videos_category_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "videos"
        DROP COLUMN "published_at",
        DROP COLUMN "visibility",
        DROP COLUMN "category_id"`,
    );
    await queryRunner.query(`DROP TYPE "public"."videos_visibility_enum"`);
    await queryRunner.query(`DROP TABLE "categories"`);
  }
}
