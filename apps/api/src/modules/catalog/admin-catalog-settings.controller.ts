import { Controller, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { CapabilityGuard } from '../../common/guards/capability.guard';
import { AdminCatalogSettingsService } from './admin-catalog-settings.service';

/**
 * `admin/catalog/{colors,sizes,price-tiers}`. It owns the bare `admin/catalog`
 * prefix, so CatalogModule registers it after the products and options
 * controllers - a `:param` route here must never shadow theirs.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller({ path: 'admin/catalog', version: '1' })
@UseGuards(AdminAuthGuard, CapabilityGuard)
export class AdminCatalogSettingsController {
  constructor(private readonly settings: AdminCatalogSettingsService) {}
}
