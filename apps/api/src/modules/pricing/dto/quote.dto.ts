import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class QuoteLineDto {
  @ApiProperty({ example: 'L' })
  @IsString()
  size!: string;

  @ApiProperty({ example: 24, minimum: 0, maximum: 100000 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  qty!: number;
}

export class QuoteDto {
  @ApiProperty({ example: 'heavyweight-tee' })
  @IsString()
  slug!: string;

  @ApiProperty({ type: [QuoteLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => QuoteLineDto)
  items!: QuoteLineDto[];

  @ApiPropertyOptional({ description: 'include shipping and tax estimate' })
  @IsOptional()
  withTotals?: boolean;
}
