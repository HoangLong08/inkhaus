import { Module } from '@nestjs/common';

import { CustomerAuthGuard } from '../../common/guards/customer-auth.guard';
import { CustomerAuthController } from './customer-auth.controller';
import { CustomerAuthService } from './customer-auth.service';

/**
 * Exports the guard alongside the service so any module with a customer-scoped
 * endpoint can `imports: [CustomerAuthModule]` and use `@UseGuards(
 * CustomerAuthGuard)` without wiring the dependency itself - the same shape as
 * AdminAuthModule.
 */
@Module({
  controllers: [CustomerAuthController],
  providers: [CustomerAuthService, CustomerAuthGuard],
  exports: [CustomerAuthService, CustomerAuthGuard],
})
export class CustomerAuthModule {}
