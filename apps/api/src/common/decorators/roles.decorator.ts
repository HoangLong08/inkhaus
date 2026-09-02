import { SetMetadata } from '@nestjs/common';
import type { AdminRole } from '@prisma/client';

export const ROLES_KEY = 'admin-roles';

/**
 * Restricts a route to the listed roles. Must be paired with `AdminAuthGuard`,
 * which is what puts `adminUser` on the request:
 *
 *   @UseGuards(AdminAuthGuard, RolesGuard)
 *   @Roles('OWNER')
 *
 * For permissions that depend on a *value* rather than the route - cancelling
 * an order, say - see `canSetStatus` in @inkhaus/shared instead.
 */
export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);
