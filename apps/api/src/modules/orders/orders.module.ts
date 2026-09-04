import { Module } from '@nestjs/common';

import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CustomerAuthModule } from '../customer-auth/customer-auth.module';
import { CustomersModule } from '../customers/customers.module';
import { PricingModule } from '../pricing/pricing.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [CatalogModule, PricingModule, CustomersModule, AdminAuthModule, CustomerAuthModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
