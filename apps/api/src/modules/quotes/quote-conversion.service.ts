import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import { CustomersService } from '../customers/customers.service';
import { OrderBuilderService } from '../orders/order-builder.service';

/**
 * Turns a bulk quote into a DRAFT order (decision D9): priced from the database
 * by OrderBuilderService rather than from the quote's snapshot, and linked so
 * the quote is WON for good and cannot be converted twice.
 */
@Injectable()
export class QuoteConversionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly builder: OrderBuilderService,
    private readonly customers: CustomersService,
  ) {}
}
