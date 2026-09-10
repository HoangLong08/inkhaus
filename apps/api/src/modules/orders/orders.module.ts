import { Module } from '@nestjs/common';

import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CustomerAuthModule } from '../customer-auth/customer-auth.module';
import { CustomersModule } from '../customers/customers.module';
import { PricingModule } from '../pricing/pricing.module';
import { AdminOrderDetailController } from './admin-order-detail.controller';
import { AdminOrderDetailService } from './admin-order-detail.service';
import { AdminOrderExportController } from './admin-order-export.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminOrdersService } from './admin-orders.service';
import { OrderBuilderService } from './order-builder.service';
import { OrderWorkflowService } from './order-workflow.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

/**
 * Exports the builder and the workflow so a bulk quote becomes an order the
 * same way checkout makes one, and every status move - from any module - goes
 * through one transaction with one set of rules.
 */
@Module({
  imports: [CatalogModule, PricingModule, CustomersModule, AdminAuthModule, CustomerAuthModule],
  // AdminOrdersController before AdminOrderDetailController: both sit on
  // admin/orders and Nest matches in registration order, so the list's static
  // paths must be registered before the detail's `:number`
  controllers: [
    OrdersController,
    AdminOrdersController,
    AdminOrderDetailController,
    AdminOrderExportController,
  ],
  providers: [
    OrdersService,
    OrderBuilderService,
    OrderWorkflowService,
    AdminOrdersService,
    AdminOrderDetailService,
  ],
  exports: [OrderBuilderService, OrderWorkflowService],
})
export class OrdersModule {}
