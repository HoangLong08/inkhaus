import { Module } from '@nestjs/common';

import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';

/**
 * Exports both guards as well as the service so any module with back-office
 * endpoints can `imports: [AdminAuthModule]` and use
 * `@UseGuards(AdminAuthGuard, RolesGuard)` without wiring the dependency itself.
 */
@Module({
  controllers: [AdminAuthController],
  providers: [AdminAuthService, AdminAuthGuard, RolesGuard],
  exports: [AdminAuthService, AdminAuthGuard, RolesGuard],
})
export class AdminAuthModule {}
