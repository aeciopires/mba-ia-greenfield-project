import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { ApiErrorEnvelope } from '../common/openapi/api-error-envelope.dto';
import { CategoryNotFoundException } from '../common/exceptions/domain.exception';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

const CATEGORY_SCHEMA = {
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    slug: { type: 'string' },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
};

@SkipThrottle()
@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List all categories',
    description: 'Returns all available video categories sorted by name.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of categories',
    schema: { type: 'array', items: CATEGORY_SCHEMA },
  })
  findAll() {
    return this.categoriesService.findAll();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get category by id' })
  @ApiResponse({ status: 200, description: 'Category found', schema: CATEGORY_SCHEMA })
  @ApiResponse({
    status: 404,
    description: 'Category not found',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async findOne(@Param('id') id: string) {
    const category = await this.categoriesService.findById(id);
    if (!category) {
      throw new CategoryNotFoundException();
    }
    return category;
  }

  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a category' })
  @ApiResponse({ status: 201, description: 'Category created', schema: CATEGORY_SCHEMA })
  @ApiResponse({
    status: 409,
    description: 'A category with this name already exists',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a category' })
  @ApiResponse({ status: 200, description: 'Category updated', schema: CATEGORY_SCHEMA })
  @ApiResponse({
    status: 404,
    description: 'Category not found',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 409,
    description: 'A category with this name already exists',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Delete a category',
    description:
      'Deletes the category. Videos that used it will have their category set to null.',
  })
  @ApiResponse({ status: 204, description: 'Category deleted' })
  @ApiResponse({
    status: 404,
    description: 'Category not found',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
