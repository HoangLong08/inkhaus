import { Module } from '@nestjs/common';

import { CatalogModule } from '../catalog/catalog.module';
import { CustomersModule } from '../customers/customers.module';
import { DesignsController } from './designs.controller';
import { DesignsService } from './designs.service';

@Module({
  imports: [CatalogModule, CustomersModule],
  controllers: [DesignsController],
  providers: [DesignsService],
  exports: [DesignsService],
})
export class DesignsModule {}
