import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';
import {
  CategoryNotFoundException,
  CategorySlugAlreadyExistsException,
} from '../common/exceptions/domain.exception';

function makeCategory(overrides: Partial<Category> = {}): Category {
  const c = new Category();
  c.id = 'cat-uuid';
  c.name = 'Education';
  c.slug = 'education';
  c.created_at = new Date();
  c.updated_at = new Date();
  return Object.assign(c, overrides);
}

function makeRepo(overrides: Record<string, jest.Mock> = {}): any {
  return {
    count: jest.fn().mockResolvedValue(0),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((dto) => Object.assign(new Category(), dto)),
    save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    remove: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('CategoriesService', () => {
  let service: CategoriesService;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(() => {
    repo = makeRepo();
    service = new CategoriesService(repo);
  });

  // ── onApplicationBootstrap ───────────────────────────────────────────────────

  describe('onApplicationBootstrap', () => {
    it('seeds 8 default categories when table is empty', async () => {
      repo.count.mockResolvedValue(0);

      await service.onApplicationBootstrap();

      expect(repo.count).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalledTimes(8);
    });

    it('skips seeding when categories already exist', async () => {
      repo.count.mockResolvedValue(3);

      await service.onApplicationBootstrap();

      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  // ── findAll ──────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns sorted list from repository', async () => {
      const cats = [makeCategory(), makeCategory({ id: 'cat-2', name: 'Gaming', slug: 'gaming' })];
      repo.find.mockResolvedValue(cats);
      const result = await service.findAll();
      expect(result).toBe(cats);
      expect(repo.find).toHaveBeenCalledWith({ order: { name: 'ASC' } });
    });
  });

  // ── findById ─────────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns category when found', async () => {
      const cat = makeCategory();
      repo.findOne.mockResolvedValue(cat);
      expect(await service.findById('cat-uuid')).toBe(cat);
    });

    it('returns null when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      expect(await service.findById('missing')).toBeNull();
    });
  });

  // ── create ───────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('generates slug from name and saves', async () => {
      repo.findOne.mockResolvedValue(null);
      const saved = makeCategory({ name: 'Science & Technology', slug: 'science-technology' });
      repo.save.mockResolvedValue(saved);

      const result = await service.create({ name: 'Science & Technology' });

      expect(repo.create).toHaveBeenCalledWith({ name: 'Science & Technology', slug: 'science-technology' });
      expect(result).toBe(saved);
    });

    it('throws CategorySlugAlreadyExistsException when slug is taken', async () => {
      repo.findOne.mockResolvedValue(makeCategory());

      await expect(service.create({ name: 'Education' })).rejects.toThrow(
        CategorySlugAlreadyExistsException,
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('slugifies accented names correctly', async () => {
      repo.findOne.mockResolvedValue(null);
      const saved = makeCategory({ name: 'Esportes', slug: 'esportes' });
      repo.save.mockResolvedValue(saved);

      await service.create({ name: 'Esportes' });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'esportes' }),
      );
    });
  });

  // ── update ───────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates name and slug when name changes', async () => {
      const cat = makeCategory({ name: 'Education', slug: 'education' });
      repo.findOne
        .mockResolvedValueOnce(cat)      // fetch by id
        .mockResolvedValueOnce(null);    // slug uniqueness check
      const saved = { ...cat, name: 'Education 2', slug: 'education-2' };
      repo.save.mockResolvedValue(saved);

      const result = await service.update('cat-uuid', { name: 'Education 2' });

      expect(result.name).toBe('Education 2');
      expect(result.slug).toBe('education-2');
    });

    it('does not check slug uniqueness when name produces same slug', async () => {
      const cat = makeCategory({ name: 'Education', slug: 'education' });
      repo.findOne.mockResolvedValueOnce(cat);
      repo.save.mockResolvedValue(cat);

      await service.update('cat-uuid', { name: 'Education' });

      expect(repo.findOne).toHaveBeenCalledTimes(1);
    });

    it('throws CategoryNotFoundException when id does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.update('missing', { name: 'New' })).rejects.toThrow(
        CategoryNotFoundException,
      );
    });

    it('throws CategorySlugAlreadyExistsException when new slug conflicts', async () => {
      const cat = makeCategory({ name: 'Education', slug: 'education' });
      const conflict = makeCategory({ id: 'cat-2', name: 'Gaming', slug: 'gaming' });
      repo.findOne
        .mockResolvedValueOnce(cat)
        .mockResolvedValueOnce(conflict);

      await expect(service.update('cat-uuid', { name: 'Gaming' })).rejects.toThrow(
        CategorySlugAlreadyExistsException,
      );
    });

    it('skips update when dto has no fields', async () => {
      const cat = makeCategory();
      repo.findOne.mockResolvedValue(cat);
      repo.save.mockResolvedValue(cat);

      const result = await service.update('cat-uuid', {});

      expect(result).toBe(cat);
      expect(repo.save).toHaveBeenCalled();
    });
  });

  // ── remove ───────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('removes the category', async () => {
      const cat = makeCategory();
      repo.findOne.mockResolvedValue(cat);

      await service.remove('cat-uuid');

      expect(repo.remove).toHaveBeenCalledWith(cat);
    });

    it('throws CategoryNotFoundException when id does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(CategoryNotFoundException);
    });
  });
});
