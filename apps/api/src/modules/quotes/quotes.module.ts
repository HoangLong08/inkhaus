import { Module } from '@nestjs/common';

import { CatalogModule } from '../catalog/catalog.module';
import { CustomersModule } from '../customers/customers.module';
import { PricingModule } from '../pricing/pricing.module';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

@Module({
  imports: [CatalogModule, PricingModule, CustomersModule],
  controllers: [QuotesController],
  providers: [QuotesService],
})
export class QuotesModule {}
