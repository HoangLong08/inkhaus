import { Module } from '@nestjs/common';

import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CustomersModule } from '../customers/customers.module';
import { AdminDesignsController } from './admin-designs.controller';
import { DesignsController } from './designs.controller';
import { DesignsService } from './designs.service';

@Module({
  imports: [CatalogModule, CustomersModule, AdminAuthModule],
  controllers: [DesignsController, AdminDesignsController],
  providers: [DesignsService],
  exports: [DesignsService],
})
export class DesignsModule {}
