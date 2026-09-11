import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  CUSTOMER_COMPANY_MAX,
  CUSTOMER_NAME_MAX,
  CUSTOMER_NOTE_MAX,
  CUSTOMER_PHONE_MAX,
} from '@inkhaus/shared';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { normaliseText } from '../admin-customers.query';

/** trimmed, and `""` becomes null - which `@IsOptional` then lets through as "clear it" */
const BlankIsNull = () => Transform(({ value }) => normaliseText(value));

/**
 * Every field is optional and nullable: send only what changed, and null (or
 * `""`) to clear one. There is deliberately no `email` - it is the customer's
 * identity, and the global `forbidNonWhitelisted` pipe answers a body that
 * carries one with a 400 instead of quietly ignoring it.
 *
 * The limits are the shared constants the admin's edit dialog checks too.
 */
export class UpdateCustomerDto {
  @ApiPropertyOptional({ nullable: true, maxLength: CUSTOMER_NAME_MAX })
  @IsOptional()
  @BlankIsNull()
  @IsString()
  @MaxLength(CUSTOMER_NAME_MAX)
  name?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: CUSTOMER_PHONE_MAX })
  @IsOptional()
  @BlankIsNull()
  @IsString()
  @MaxLength(CUSTOMER_PHONE_MAX)
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: CUSTOMER_COMPANY_MAX })
  @IsOptional()
  @BlankIsNull()
  @IsString()
  @MaxLength(CUSTOMER_COMPANY_MAX)
  company?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: CUSTOMER_NOTE_MAX,
    description: 'staff-only; never sent to the storefront',
  })
  @IsOptional()
  @BlankIsNull()
  @IsString()
  @MaxLength(CUSTOMER_NOTE_MAX)
  adminNote?: string | null;
}
