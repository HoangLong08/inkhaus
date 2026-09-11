import { ApiPropertyOptional } from '@nestjs/swagger';
import { QuoteStatus } from '@prisma/client';
import { QUOTE_SORTS, type QuoteSort } from '@inkhaus/shared';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';
import { QUOTE_FOLLOW_UP_FILTERS, type QuoteFollowUpFilter } from '../admin-quotes.rules';

export class AdminListQuotesDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'part of the email, name or company - any case',
    maxLength: 100,
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  // not @IsEmail: the box is filled a keystroke at a time
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: QuoteStatus })
  @IsOptional()
  @IsEnum(QuoteStatus)
  status?: QuoteStatus;

  @ApiPropertyOptional({
    description: '`me` for the caller, `none` for unassigned, or an admin id',
    example: 'me',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,64}$/, { message: 'assignee must be "me", "none" or an admin id' })
  assignee?: string;

  @ApiPropertyOptional({
    enum: QUOTE_FOLLOW_UP_FILTERS,
    description: 'open quotes whose follow-up day has passed, or is today or later (UTC)',
  })
  @IsOptional()
  @IsIn(QUOTE_FOLLOW_UP_FILTERS)
  followUp?: QuoteFollowUpFilter;

  @ApiPropertyOptional({ enum: QUOTE_SORTS, default: 'created_desc' })
  @IsOptional()
  @IsIn(QUOTE_SORTS)
  sort: QuoteSort = 'created_desc';
}
