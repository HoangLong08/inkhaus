import { ApiPropertyOptional } from '@nestjs/swagger';
import { GarmentType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListProductsDto {
  @ApiPropertyOptional({ enum: GarmentType })
  @IsOptional()
  @IsEnum(GarmentType)
  type?: GarmentType;

  @ApiPropertyOptional({ description: 'free-text search over name, blurb and fabric' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @ApiPropertyOptional({ default: 50, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;

  @ApiPropertyOptional({ description: 'admin only - include archived blanks' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeInactive = false;
}
