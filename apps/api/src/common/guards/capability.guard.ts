import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ADMIN_CAPABILITIES, can, type AdminAction } from '@inkhaus/shared';

import { CAN_KEY } from '../decorators/can.decorator';
import type { AdminRequest } from './admin-auth.guard';

/**
 * Checks the route's `@Can(action)` against the role `AdminAuthGuard` already
 * loaded. Guards run in the order they are listed, so this must come after it.
 *
 * Unlike RolesGuard, a route with no `@Can` is refused rather than let through.
 * Every handler on an admin controller has to say what it needs: one added
 * without a decorator fails its first request loudly instead of quietly being
 * open to every role.
 */
@Injectable()
export class CapabilityGuard implements CanActivate {
  private readonly logger = new Logger(CapabilityGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const action = this.reflector.getAllAndOverride<AdminAction | undefined>(CAN_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (!action || !Object.hasOwn(ADMIN_CAPABILITIES, action)) {
      this.logger.error(
        `${ctx.getClass().name}.${ctx.getHandler().name} declares no known @Can - refusing`,
      );
      throw new ForbiddenException('This endpoint does not declare a capability');
    }

    const user = ctx.switchToHttp().getRequest<AdminRequest>().adminUser;
    if (!user) {
      // reachable only if this guard is wired without AdminAuthGuard in front,
      // which is a coding mistake - deny rather than assume
      throw new ForbiddenException('Not authenticated');
    }

    if (!can(user.role, action)) {
      throw new ForbiddenException(
        `This needs the "${action}" permission, which ${user.role.toLowerCase()} accounts do not have.`,
      );
    }
    return true;
  }
}
