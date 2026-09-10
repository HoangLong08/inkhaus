import { Global, Module } from '@nestjs/common';

import { AuditService } from './audit.service';

/**
 * Global for the same reason PrismaModule is: catalog, customers, reviews,
 * staff and the order export all write to it, and an audit trail that a module
 * can forget to import is one that has gaps.
 */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
