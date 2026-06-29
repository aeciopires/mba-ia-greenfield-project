import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { VoteType } from '../video-like.entity';

export class VoteDto {
  @ApiProperty({ enum: VoteType, example: VoteType.LIKE })
  @IsEnum(VoteType)
  type: VoteType;
}
