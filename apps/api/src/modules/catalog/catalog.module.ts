import { Module } from '@nestjs/common';

import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { AdminCatalogOptionsController } from './admin-catalog-options.controller';
import { AdminCatalogSettingsController } from './admin-catalog-settings.controller';
import { AdminCatalogSettingsService } from './admin-catalog-settings.service';
import { AdminCatalogController } from './admin-catalog.controller';
import { AdminCatalogService } from './admin-catalog.service';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { PriceEditsPolicy } from './price-edits.policy';

@Module({
  imports: [AdminAuthModule],
  // the settings controller owns the bare admin/catalog prefix, so it goes last:
  // Nest matches in registration order, and none of its routes may shadow
  // admin/catalog/options or admin/catalog/products
  controllers: [
    CatalogController,
    AdminCatalogOptionsController,
    AdminCatalogController,
    AdminCatalogSettingsController,
  ],
  providers: [CatalogService, AdminCatalogService, AdminCatalogSettingsService, PriceEditsPolicy],
  exports: [CatalogService, PriceEditsPolicy],
})
export class CatalogModule {}
