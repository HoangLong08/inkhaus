import { Injectable } from '@nestjs/common';

import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PriceEditsPolicy } from './price-edits.policy';

/**
 * Products in the back office. Price fields need `catalog.price` and an open
 * PriceEditsPolicy; everything else is `catalog.edit`. Every change is audited.
 */
@Injectable()
export class AdminCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly priceEdits: PriceEditsPolicy,
  ) {}
}
