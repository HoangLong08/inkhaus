import { Injectable } from '@nestjs/common';

import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PriceEditsPolicy } from './price-edits.policy';

/**
 * Colours, sizes and the price-tier ladder. Upcharges and tiers are prices, so
 * they sit behind PriceEditsPolicy as well as `catalog.price`.
 */
@Injectable()
export class AdminCatalogSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly priceEdits: PriceEditsPolicy,
  ) {}
}
