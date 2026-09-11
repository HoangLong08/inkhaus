import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CATALOG_LIMITS, TIER_LIMITS } from '@inkhaus/shared';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { RawBoolean } from '../../../common/dto/raw-boolean.decorator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** the numbers the admin's colour and size dialogs check too */
const { color: COLOR, size: SIZE, sortOrder: SORT } = CATALOG_LIMITS;

// ------------------------------------------------------------------ colours

export class AdminCreateColorDto {
  @ApiProperty({ pattern: '^[a-z0-9-]{2,40}$' })
  @Matches(/^[a-z0-9-]{2,40}$/, { message: 'slug must be 2-40 lowercase letters, digits or dashes' })
  slug!: string;

  @ApiProperty({ maxLength: COLOR.name })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(COLOR.name)
  name!: string;

  @ApiProperty({ example: '#1A7F7A' })
  @Matches(HEX, { message: 'hex must be a colour like #1A7F7A' })
  hex!: string;

  @ApiPropertyOptional({ default: false, description: 'artwork on it needs light ink' })
  @IsOptional()
  @RawBoolean()
  dark?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(SORT.min)
  @Max(SORT.max)
  sortOrder?: number;
}

/** no slug - order lines and product images point at it - and no delete (D11) */
export class AdminUpdateColorDto {
  @ApiPropertyOptional({ maxLength: COLOR.name })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(COLOR.name)
  name?: string;

  @ApiPropertyOptional({ example: '#1A7F7A' })
  @IsOptional()
  @Matches(HEX, { message: 'hex must be a colour like #1A7F7A' })
  hex?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @RawBoolean()
  dark?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(SORT.min)
  @Max(SORT.max)
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'false archives it: it stays where it is, and cannot be added anew' })
  @IsOptional()
  @RawBoolean()
  active?: boolean;
}

// -------------------------------------------------------------------- sizes

export class AdminCreateSizeDto {
  @ApiProperty({ pattern: '^[A-Z0-9]{1,6}$' })
  @Matches(/^[A-Z0-9]{1,6}$/, { message: 'code must be 1-6 capital letters or digits' })
  code!: string;

  @ApiProperty({ maxLength: SIZE.label })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(SIZE.label)
  label!: string;

  @ApiProperty({
    minimum: SIZE.upcharge.min,
    maximum: SIZE.upcharge.max,
    description: 'USD per unit on top of the tier price',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(SIZE.upcharge.min)
  @Max(SIZE.upcharge.max)
  upcharge!: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(SORT.min)
  @Max(SORT.max)
  sortOrder?: number;
}

/** no code - it is what order lines and product size runs store */
export class AdminUpdateSizeDto {
  @ApiPropertyOptional({ maxLength: SIZE.label })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(SIZE.label)
  label?: string;

  @ApiPropertyOptional({
    minimum: SIZE.upcharge.min,
    maximum: SIZE.upcharge.max,
    description: 'owner-only, and needs price edits on',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(SIZE.upcharge.min)
  @Max(SIZE.upcharge.max)
  upcharge?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(SORT.min)
  @Max(SORT.max)
  sortOrder?: number;
}

// -------------------------------------------------------------- price tiers

export class TierInputDto {
  @ApiProperty({ description: 'the quantity this tier starts at' })
  @IsInt()
  minQty!: number;

  @ApiProperty({ description: 'fraction off list, 0..0.9 - 0.12 is 12%' })
  @IsNumber()
  discount!: number;
}

/**
 * The whole ladder, replaced at once. Only the shapes are checked here; the
 * ladder's own rules (starts at 1/0, strictly increasing, never a smaller
 * discount) are `validateTiers` in @inkhaus/shared, which the service runs so
 * the 400 carries the same sentence the tier editor shows.
 */
export class AdminReplaceTiersDto {
  @ApiProperty({ type: [TierInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(TIER_LIMITS.maxTiers)
  @ValidateNested({ each: true })
  @Type(() => TierInputDto)
  tiers!: TierInputDto[];
}
