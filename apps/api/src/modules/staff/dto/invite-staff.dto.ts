import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { normalizeStaffEmail, STAFF_NAME_MAX } from '../staff.plan';

export class InviteStaffDto {
  @ApiProperty({
    example: 'jamie@inkhaus.test',
    description:
      'the Google account they will sign in with. Trimmed and lower-cased, which is the form sign-in compares against',
  })
  // normalised before @IsEmail runs, so the address that is checked is the one
  // that is stored - and the one Google will hand back at sign-in
  @Transform(({ value }) => (typeof value === 'string' ? normalizeStaffEmail(value) : value))
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiPropertyOptional({
    maxLength: STAFF_NAME_MAX,
    description: 'optional - Google fills it in on their first sign-in when left blank',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(STAFF_NAME_MAX)
  name?: string;

  @ApiPropertyOptional({ enum: AdminRole, default: AdminRole.STAFF })
  @IsOptional()
  @IsEnum(AdminRole)
  role: AdminRole = AdminRole.STAFF;
}
