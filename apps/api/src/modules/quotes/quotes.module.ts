import { Module } from '@nestjs/common';

import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CustomersModule } from '../customers/customers.module';
import { OrdersModule } from '../orders/orders.module';
import { PricingModule } from '../pricing/pricing.module';
import { AdminQuotesController } from './admin-quotes.controller';
import { AdminQuotesService } from './admin-quotes.service';
import { QuoteConversionService } from './quote-conversion.service';
import { QuoteWorkflowService } from './quote-workflow.service';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

/** OrdersModule for OrderBuilderService: a converted quote is priced like checkout. */
@Module({
  imports: [CatalogModule, PricingModule, CustomersModule, AdminAuthModule, OrdersModule],
  controllers: [QuotesController, AdminQuotesController],
  providers: [QuotesService, AdminQuotesService, QuoteWorkflowService, QuoteConversionService],
})
export class QuotesModule {}
