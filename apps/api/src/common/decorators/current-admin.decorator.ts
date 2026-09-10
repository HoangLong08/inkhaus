import { createParamDecorator, ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { AdminUser } from '@prisma/client';

import type { AdminRequest } from '../guards/admin-auth.guard';

/**
 * The staff member `AdminAuthGuard` resolved for this request:
 *
 *   @UseGuards(AdminAuthGuard, CapabilityGuard)
 *   @Can('orders.advance')
 *   advance(@CurrentAdmin() admin: AdminUser) { ... }
 *
 * Replaces `@Req() req: AdminRequest` plus `req.adminUser!` - a non-null
 * assertion is a promise nothing checks. This one checks: a handler reached
 * without the guard in front is a wiring mistake, and it is refused rather than
 * handed an `undefined` typed as a user.
 */
export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AdminUser => {
    const user = ctx.switchToHttp().getRequest<AdminRequest>().adminUser;
    if (!user) throw new ForbiddenException('Not authenticated');
    return user;
  },
);
