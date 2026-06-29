import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateVideoDto {
  @ApiProperty({ example: 'My Awesome Video', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ example: 'A video description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: 'video/mp4',
    description: 'MIME type of the video file',
  })
  @IsString()
  @IsNotEmpty()
  content_type: string;
}
