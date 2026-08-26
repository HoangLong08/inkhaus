import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PrintMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderSizeDto {
  @ApiProperty({ example: 'L' })
  @IsString()
  size!: string;

  @ApiProperty({ example: 12, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty!: number;
}

export class OrderItemDto {
  @ApiProperty({ example: 'heavyweight-tee' })
  @IsString()
  productSlug!: string;

  @ApiProperty({ example: 'black' })
  @IsString()
  colorSlug!: string;

  @ApiProperty({ enum: PrintMethod, example: PrintMethod.DTG })
  @IsEnum(PrintMethod)
  method!: PrintMethod;

  @ApiPropertyOptional({ description: 'design publicId from POST /designs' })
  @IsOptional()
  @IsString()
  designId?: string;

  @ApiProperty({ type: [OrderSizeDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => OrderSizeDto)
  sizes!: OrderSizeDto[];
}

export class CustomerDto {
  @ApiProperty({ example: 'crew@inkhaus.test' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  company?: string;
}

export class ShippingDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) line1?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) line2?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) postal?: string;
  @ApiPropertyOptional({ default: 'US' }) @IsOptional() @IsString() @MaxLength(2) country?: string;
}

export class CreateOrderDto {
  @ApiProperty({ type: CustomerDto })
  @ValidateNested()
  @Type(() => CustomerDto)
  customer!: CustomerDto;

  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @ApiPropertyOptional({ type: ShippingDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingDto)
  shipping?: ShippingDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
