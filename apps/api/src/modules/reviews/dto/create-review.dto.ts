import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({ example: 'Marisol R.' })
  @IsString()
  @MaxLength(80)
  author!: string;

  @ApiPropertyOptional({ example: '@marisol' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  handle?: string;

  @ApiProperty({ minimum: 1, maximum: 5, default: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating = 5;

  @ApiProperty()
  @IsString()
  @MaxLength(1000)
  body!: string;

  @ApiPropertyOptional({ example: 'heavyweight-tee' })
  @IsOptional()
  @IsString()
  productSlug?: string;
}
