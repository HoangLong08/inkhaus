import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  CATEGORIES,
  GARMENT_TYPES,
  PRINT_METHODS,
  type GarmentType,
  type PrintMethodCode,
  type ProductCategory,
} from '@inkhaus/shared';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  NotEquals,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** where the artwork may go, in the garment SVG's viewBox units */
export class PrintAreaDto {
  @ApiProperty() @IsInt() @Min(0) @Max(1000) x!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(1000) y!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(1000) w!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(1000) h!: number;
}

/** the same area on the real garment, inches - drives the storefront's DPI check */
export class PrintInchesDto {
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.5)
  @Max(40)
  w!: number;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.5)
  @Max(40)
  h!: number;
}

/**
 * Every editable field of a blank. `price` and `bulkPrice` are owner-only and
 * need CATALOG_PRICE_EDITS on - that is checked in the service, because it
 * depends on who is asking and on the body, not on the route.
 */
export class ProductInputDto {
  @ApiProperty({ maxLength: 80 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ enum: GARMENT_TYPES, description: 'which blank shape the studio draws' })
  @IsIn(GARMENT_TYPES)
  type!: GarmentType;

  @ApiProperty({ enum: CATEGORIES })
  @IsIn(CATEGORIES)
  category!: ProductCategory;

  @ApiProperty({ maxLength: 400 })
  @Transform(trim)
  @IsString()
  @MaxLength(400)
  blurb!: string;

  @ApiProperty({ maxLength: 200 })
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  fabric!: string;

  @ApiPropertyOptional({ maxLength: 24, nullable: true, description: 'empty or null clears it' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(24)
  tag?: string | null;

  @ApiProperty({
    type: [String],
    description: 'size codes from the sizes table; empty means the default apparel run',
  })
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^[A-Z0-9]{1,6}$/, { each: true })
  sizes!: string[];

  @ApiProperty({ minimum: 0.5, maximum: 1000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.5)
  @Max(1000)
  price!: number;

  @ApiProperty({ minimum: 0.5, maximum: 1000, description: 'the 50+ floor; never above price' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.5)
  @Max(1000)
  bulkPrice!: number;

  @ApiProperty({ enum: PRINT_METHODS, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(PRINT_METHODS, { each: true })
  methods!: PrintMethodCode[];

  @ApiProperty({ type: PrintAreaDto })
  @ValidateNested()
  @Type(() => PrintAreaDto)
  printArea!: PrintAreaDto;

  @ApiProperty({ type: PrintInchesDto })
  @ValidateNested()
  @Type(() => PrintInchesDto)
  printInches!: PrintInchesDto;

  @ApiProperty({ type: [String], description: 'colour slugs in storefront order' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ArrayUnique()
  @IsString({ each: true })
  colorSlugs!: string[];

  @ApiProperty({ description: 'false archives it: checkout refuses it, orders keep it' })
  @IsBoolean()
  active!: boolean;

  @ApiProperty({ minimum: 0, maximum: 99999 })
  @IsInt()
  @Min(0)
  @Max(99999)
  sortOrder!: number;
}

/** `POST /admin/catalog/products` - a whole blank, including the slug it will live at */
export class AdminCreateProductDto extends ProductInputDto {
  @ApiProperty({ pattern: '^[a-z0-9-]{2,60}$' })
  @Matches(/^[a-z0-9-]{2,60}$/, {
    message: 'slug must be 2-60 lowercase letters, digits or dashes',
  })
  // the back office's own create page lives at /catalog/products/new, so a
  // product called "new" could never be opened there
  @NotEquals('new', { message: 'slug cannot be "new"' })
  slug!: string;
}

/**
 * `PATCH /admin/catalog/products/:slug` - any subset. The slug is not here: it
 * is the storefront URL and the key saved carts point at.
 */
export class AdminUpdateProductDto extends PartialType(ProductInputDto) {}
