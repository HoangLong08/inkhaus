import { Module } from '@nestjs/common';

import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { AdminStaffController } from './admin-staff.controller';
import { StaffService } from './staff.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [AdminStaffController],
  providers: [StaffService],
})
export class StaffModule {}
