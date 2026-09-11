import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

/**
 * INK-000123 today. Letters, digits and dashes only, and short: a path segment
 * that is refused here never reaches a query, and a typo'd link answers 400
 * rather than a lookup for something no order number could ever be.
 */
export const ORDER_NUMBER_PATTERN = /^[A-Za-z0-9-]{1,32}$/;

/** the `:number` in every `admin/orders/:number` route */
export class OrderNumberParamsDto {
  @ApiProperty({ example: 'INK-000123', pattern: ORDER_NUMBER_PATTERN.source })
  @Matches(ORDER_NUMBER_PATTERN, { message: 'number must look like an order number, e.g. INK-000123' })
  number!: string;
}
