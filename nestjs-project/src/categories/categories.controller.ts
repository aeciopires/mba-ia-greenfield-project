import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { CategoriesService } from './categories.service';

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
    schema: {
      type: 'array',
      items: {
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          slug: { type: 'string' },
        },
      },
    },
  })
  findAll() {
    return this.categoriesService.findAll();
  }
}
