import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  CATEGORIES,
  GARMENT_TYPES,
  PRODUCT_ACTIVE_FILTERS,
  PRODUCT_SORTS,
  type GarmentType,
  type ProductActiveFilter,
  type ProductCategory,
  type ProductSort,
} from '@inkhaus/shared';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';

/** `GET /admin/catalog/products` - archived blanks included unless asked otherwise */
export class AdminListProductsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'part of a name or slug, any case', maxLength: 100 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: CATEGORIES })
  @IsOptional()
  @IsIn(CATEGORIES)
  category?: ProductCategory;

  @ApiPropertyOptional({ enum: GARMENT_TYPES, description: 'the storefront slug, e.g. "tee"' })
  @IsOptional()
  @IsIn(GARMENT_TYPES)
  type?: GarmentType;

  @ApiPropertyOptional({ enum: PRODUCT_ACTIVE_FILTERS, default: 'all' })
  @IsOptional()
  @IsIn(PRODUCT_ACTIVE_FILTERS)
  active: ProductActiveFilter = 'all';

  @ApiPropertyOptional({ enum: PRODUCT_SORTS, default: 'sort_asc' })
  @IsOptional()
  @IsIn(PRODUCT_SORTS)
  sort: ProductSort = 'sort_asc';
}
