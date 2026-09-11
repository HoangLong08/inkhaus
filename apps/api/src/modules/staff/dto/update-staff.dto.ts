import { ApiPropertyOptional } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { STAFF_NAME_MAX } from '../staff.plan';

/**
 * Every field optional; a field left out is left alone. Whether the change is
 * allowed at all is `staffChangeError`'s decision, made in the service against
 * the rows as they are inside the transaction - not here.
 */
export class UpdateStaffDto {
  @ApiPropertyOptional({
    nullable: true,
    maxLength: STAFF_NAME_MAX,
    description: 'blank or null clears it; Google fills it in again on their next sign-in',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(STAFF_NAME_MAX)
  name?: string | null;

  @ApiPropertyOptional({ enum: AdminRole })
  @IsOptional()
  @IsEnum(AdminRole)
  role?: AdminRole;

  @ApiPropertyOptional({
    description: 'false deactivates the account and ends every session at once; true reactivates it',
  })
  @IsOptional()
  // The raw JSON value, not the converted one. The global pipe enables implicit
  // conversion, which turns the string "false" into Boolean("false") - true -
  // and on this field that would make a hand-made deactivation reactivate
  // someone instead. A real boolean, or a 400.
  @Transform(({ obj, key }) => (obj as Record<string, unknown>)[key])
  @IsBoolean()
  isActive?: boolean;
}
