import { Module } from '@nestjs/common';

import { CatalogModule } from '../catalog/catalog.module';
import { CustomersModule } from '../customers/customers.module';
import { PricingModule } from '../pricing/pricing.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [CatalogModule, PricingModule, CustomersModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
