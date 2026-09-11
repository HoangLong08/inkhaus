import { ApiPropertyOptional } from '@nestjs/swagger';
import { QuoteStatus } from '@prisma/client';
import { IsEnum, IsISO8601, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';

export class AdminUpdateQuoteDto {
  @ApiPropertyOptional({ enum: QuoteStatus })
  // ValidateIf rather than IsOptional: IsOptional would wave a `null` through,
  // and a quote cannot have no status
  @ValidateIf((dto: AdminUpdateQuoteDto) => dto.status !== undefined)
  @IsEnum(QuoteStatus)
  status?: QuoteStatus;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'an active admin, or null to unassign',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  assigneeId?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '2026-09-14',
    description: 'the UTC day to chase the lead on, or null to clear it',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'followUpAt must be a YYYY-MM-DD day' })
  // strict: 2026-02-31 is well formed and still not a day
  @IsISO8601({ strict: true }, { message: 'followUpAt must be a real day' })
  followUpAt?: string | null;
}
