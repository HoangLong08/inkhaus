import { ApiPropertyOptional } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { STAFF_NAME_MAX } from '@inkhaus/shared';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { RawBoolean } from '../../../common/dto/raw-boolean.decorator';

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
  // The raw JSON value, not the converted one: implicit conversion would read
  // the string "false" as true, and on this field that makes a hand-made
  // deactivation reactivate someone instead. A real boolean, or a 400.
  @RawBoolean()
  isActive?: boolean;
}
