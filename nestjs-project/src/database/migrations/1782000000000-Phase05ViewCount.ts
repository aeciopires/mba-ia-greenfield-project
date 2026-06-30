import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase05ViewCount1782000000000 implements MigrationInterface {
  name = 'Phase05ViewCount1782000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "videos" ADD COLUMN "view_count" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_videos_view_count" ON "videos" ("view_count" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_videos_view_count"`);
    await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN "view_count"`);
  }
}
