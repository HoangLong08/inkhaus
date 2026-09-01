import { Module } from '@nestjs/common';

import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';

/**
 * Exports the guard as well as the service so any module with back-office
 * endpoints can `imports: [AdminAuthModule]` and use `@UseGuards(AdminAuthGuard)`
 * without wiring the dependency itself.
 */
@Module({
  controllers: [AdminAuthController],
  providers: [AdminAuthService, AdminAuthGuard],
  exports: [AdminAuthService, AdminAuthGuard],
})
export class AdminAuthModule {}
