import { ApiProperty } from '@nestjs/swagger';
import { ReviewStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class AdminModerateReviewDto {
  @ApiProperty({ enum: ReviewStatus, description: 'PENDING sends it back to the queue' })
  @IsEnum(ReviewStatus)
  status!: ReviewStatus;
}
