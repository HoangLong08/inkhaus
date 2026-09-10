import { Module } from '@nestjs/common';

import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { AdminCustomersController } from './admin-customers.controller';
import { AdminCustomersService } from './admin-customers.service';
import { CustomersService } from './customers.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [AdminCustomersController],
  providers: [CustomersService, AdminCustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
