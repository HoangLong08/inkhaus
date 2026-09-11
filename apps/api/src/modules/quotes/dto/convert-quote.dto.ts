import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PrintMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ConvertSizeDto {
  @ApiProperty({ example: 'M' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(8)
  size!: string;

  @ApiProperty({ example: 24, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  qty!: number;
}

/** where the order goes - all or nothing, so a draft never holds half an address */
export class ConvertShippingDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(160) line1!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) line2?: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(80) city!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(80) state!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(20) postal!: string;

  @ApiPropertyOptional({ default: 'US', example: 'US' })
  @IsOptional()
  @Matches(/^[A-Z]{2}$/, { message: 'country must be a two-letter code' })
  country?: string;
}

/**
 * One order line, the way checkout sends one: slugs and quantities only.
 * Nothing about money - the order is priced from the database.
 */
export class ConvertQuoteDto {
  @ApiProperty({ example: 'heavyweight-tee' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  productSlug!: string;

  @ApiProperty({ example: 'black' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  colorSlug!: string;

  @ApiProperty({ enum: PrintMethod, example: PrintMethod.DTG })
  @IsEnum(PrintMethod)
  method!: PrintMethod;

  @ApiProperty({ type: [ConvertSizeDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique((line: ConvertSizeDto) => line?.size, { message: 'each size may appear only once' })
  @ValidateNested({ each: true })
  @Type(() => ConvertSizeDto)
  sizes!: ConvertSizeDto[];

  @ApiPropertyOptional({ description: 'a design publicId made for this product' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  designId?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({ type: ConvertShippingDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ConvertShippingDto)
  shipping?: ConvertShippingDto;
}
