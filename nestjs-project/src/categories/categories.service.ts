import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CategoryNotFoundException,
  CategorySlugAlreadyExistsException,
} from '../common/exceptions/domain.exception';
import { Category } from './entities/category.entity';
import type { CreateCategoryDto } from './dto/create-category.dto';
import type { UpdateCategoryDto } from './dto/update-category.dto';

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async findAll(): Promise<Category[]> {
    return this.categoryRepository.find({ order: { name: 'ASC' } });
  }

  async findById(id: string): Promise<Category | null> {
    return this.categoryRepository.findOne({ where: { id } });
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    const slug = toSlug(dto.name);
    const existing = await this.categoryRepository.findOne({ where: { slug } });
    if (existing) {
      throw new CategorySlugAlreadyExistsException();
    }
    const category = this.categoryRepository.create({ name: dto.name, slug });
    return this.categoryRepository.save(category);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) {
      throw new CategoryNotFoundException();
    }

    if (dto.name !== undefined) {
      const slug = toSlug(dto.name);
      if (slug !== category.slug) {
        const conflict = await this.categoryRepository.findOne({ where: { slug } });
        if (conflict) {
          throw new CategorySlugAlreadyExistsException();
        }
        category.slug = slug;
      }
      category.name = dto.name;
    }

    return this.categoryRepository.save(category);
  }

  async remove(id: string): Promise<void> {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) {
      throw new CategoryNotFoundException();
    }
    await this.categoryRepository.remove(category);
  }
}
