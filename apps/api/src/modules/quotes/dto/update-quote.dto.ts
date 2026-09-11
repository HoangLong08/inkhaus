import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuoteStatus } from '@prisma/client';
import { QUOTE_NOTE_MAX } from '@inkhaus/shared';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateBulkQuoteDto {
  @ApiProperty({ enum: QuoteStatus })
  @IsEnum(QuoteStatus)
  status!: QuoteStatus;

  @ApiPropertyOptional({
    description: "added to the quote's history as a staff note - the customer's own message is never overwritten",
    maxLength: QUOTE_NOTE_MAX,
  })
  @IsOptional()
  @IsString()
  // the same limit as every other quote note - it becomes one
  @MaxLength(QUOTE_NOTE_MAX)
  message?: string;
}
