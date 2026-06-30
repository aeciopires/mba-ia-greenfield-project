import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateChannelDto {
  @ApiPropertyOptional({ example: 'My Channel', maxLength: 50 })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ example: 'My channel description' })
  @IsString()
  @IsOptional()
  description?: string;
}
