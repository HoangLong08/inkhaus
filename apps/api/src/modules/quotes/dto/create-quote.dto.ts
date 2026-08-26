import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PrintMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateBulkQuoteDto {
  @ApiProperty({ example: 'coach@school.test' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) company?: string;

  @ApiPropertyOptional({ example: 'heavyweight-tee' })
  @IsOptional()
  @IsString()
  productSlug?: string;

  @ApiProperty({ example: 120, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantity!: number;

  @ApiPropertyOptional({ enum: PrintMethod })
  @IsOptional()
  @IsEnum(PrintMethod)
  method?: PrintMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
