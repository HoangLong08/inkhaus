import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AdminRole } from '@prisma/client';

import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AdminRequest } from './admin-auth.guard';

/**
 * Checks the role `AdminAuthGuard` already loaded. Guards run in the order they
 * are listed, so this must always come after it - on its own it would let
 * everything through, because there would be no `adminUser` to reject.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AdminRole[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required?.length) return true;

    const user = ctx.switchToHttp().getRequest<AdminRequest>().adminUser;
    if (!user) {
      // reachable only if this guard is wired without AdminAuthGuard in front,
      // which is a coding mistake - deny rather than assume
      throw new ForbiddenException('Not authenticated');
    }

    if (!required.includes(user.role)) {
      throw new ForbiddenException(`This action is limited to: ${required.join(', ').toLowerCase()}`);
    }
    return true;
  }
}
