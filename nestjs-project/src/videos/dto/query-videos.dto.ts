import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class QueryVideosDto {
  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 50, default: 20 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by category UUID' })
  @IsUUID()
  @IsOptional()
  category_id?: string;

  @ApiPropertyOptional({ description: 'Filter by channel UUID' })
  @IsUUID()
  @IsOptional()
  channel_id?: string;

  @ApiPropertyOptional({
    description: 'Full-text search on title and channel nickname',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  q?: string;
}
