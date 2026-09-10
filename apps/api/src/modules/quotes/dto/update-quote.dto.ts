import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuoteStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateBulkQuoteDto {
  @ApiProperty({ enum: QuoteStatus })
  @IsEnum(QuoteStatus)
  status!: QuoteStatus;

  @ApiPropertyOptional({
    description: "added to the quote's history as a staff note - the customer's own message is never overwritten",
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
