import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import configuration from './config/configuration';
import { PrismaModule } from './common/prisma/prisma.module';
import { AdminAuthModule } from './modules/admin-auth/admin-auth.module';
import { AssetsModule } from './modules/assets/assets.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CustomerAuthModule } from './modules/customer-auth/customer-auth.module';
import { DesignsModule } from './modules/designs/designs.module';
import { HealthModule } from './modules/health/health.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { ReviewsModule } from './modules/reviews/reviews.module';

@Module({
  imports: [
    // `ignoreEnvFile`: the env is already in process.env by the time Nest
    // starts - src/load-env.ts read the repo-root .env before this module was
    // even imported. Leaving it on would have ConfigModule hunt for an
    // apps/api/.env that no longer exists.
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [configuration], cache: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    HealthModule,
    AdminAuthModule,
    CustomerAuthModule,
    CatalogModule,
    AssetsModule,
    PricingModule,
    DesignsModule,
    OrdersModule,
    QuotesModule,
    ReviewsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
