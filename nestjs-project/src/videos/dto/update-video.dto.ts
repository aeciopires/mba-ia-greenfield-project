import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { VideoVisibility } from '../entities/video.entity';

export class UpdateVideoDto {
  @ApiPropertyOptional({ example: 'My updated title', maxLength: 255 })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Category UUID (null to remove)' })
  @IsUUID()
  @IsOptional()
  category_id?: string;

  @ApiPropertyOptional({
    enum: VideoVisibility,
    example: VideoVisibility.PUBLIC,
  })
  @IsEnum(VideoVisibility)
  @IsOptional()
  visibility?: VideoVisibility;
}
