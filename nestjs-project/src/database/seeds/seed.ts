import { AppDataSource } from '../data-source';
import { Category } from '../../categories/entities/category.entity';

const CATEGORIES = [
  { name: 'Education', slug: 'education' },
  { name: 'Entertainment', slug: 'entertainment' },
  { name: 'Gaming', slug: 'gaming' },
  { name: 'Music', slug: 'music' },
  { name: 'News & Politics', slug: 'news-politics' },
  { name: 'Science & Technology', slug: 'science-technology' },
  { name: 'Sports', slug: 'sports' },
  { name: 'Travel & Events', slug: 'travel-events' },
];

async function runSeed(): Promise<void> {
  await AppDataSource.initialize();
  console.log('Database connection initialized');

  const repo = AppDataSource.getRepository(Category);

  for (const data of CATEGORIES) {
    const exists = await repo.findOneBy({ slug: data.slug });
    if (!exists) {
      await repo.save(repo.create(data));
      console.log(`Created category: ${data.name}`);
    } else {
      console.log(`Category already exists: ${data.name}`);
    }
  }

  await AppDataSource.destroy();
  console.log('Database connection closed');
}

runSeed().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
