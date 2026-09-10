import { ApiPropertyOptional } from '@nestjs/swagger';
import { GarmentType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * The storefront's product query. There is no `includeInactive` any more - the
 * route is public, so archived blanks are the back office's business and live
 * behind /admin/catalog. Sending it now answers 400 through the global
 * `forbidNonWhitelisted`, so a caller relying on it finds out at once.
 */
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
}
