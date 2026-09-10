import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Can } from '../../common/decorators/can.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { CapabilityGuard } from '../../common/guards/capability.guard';
import { CatalogService, type CatalogOptions } from './catalog.service';
import { PriceEditsPolicy } from './price-edits.policy';

export type AdminCatalogOptions = CatalogOptions & { priceEditsEnabled: boolean };

/**
 * The lookups a back-office form builds from - products with the methods,
 * sizes and colours each can be ordered in, the price ladder, and whether
 * prices may be edited right now. One call, so a dialog is not four requests.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller({ path: 'admin/catalog/options', version: '1' })
@UseGuards(AdminAuthGuard, CapabilityGuard)
export class AdminCatalogOptionsController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly priceEdits: PriceEditsPolicy,
  ) {}

  @Get()
  @Can('catalog.view')
  @ApiOperation({
    summary: 'Active products with their methods, sizes and colours, plus the price ladder',
  })
  async options(): Promise<AdminCatalogOptions> {
    const { products, ladder } = await this.catalog.adminOptions();
    return { products, ladder, priceEditsEnabled: this.priceEdits.enabled };
  }
}
