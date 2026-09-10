import { Module } from '@nestjs/common';

import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { CapabilityGuard } from '../../common/guards/capability.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';

/**
 * Exports the guards as well as the service so any module with back-office
 * endpoints can `imports: [AdminAuthModule]` and use
 * `@UseGuards(AdminAuthGuard, CapabilityGuard)` - or the older RolesGuard -
 * without wiring the dependency itself.
 *
 * Imports nothing on purpose: every admin module imports this one, so a
 * dependency here would be a cycle waiting to happen.
 */
@Module({
  controllers: [AdminAuthController],
  providers: [AdminAuthService, AdminAuthGuard, RolesGuard, CapabilityGuard],
  exports: [AdminAuthService, AdminAuthGuard, RolesGuard, CapabilityGuard],
})
export class AdminAuthModule {}
