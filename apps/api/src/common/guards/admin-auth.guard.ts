import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AdminUser } from '@prisma/client';
import type { Request } from 'express';

import { AdminAuthService } from '../../modules/admin-auth/admin-auth.service';

/** what the guard hangs off the request once a token checks out */
export type AdminRequest = Request & { adminUser?: AdminUser };

/**
 * Bearer-token gate for every back-office endpoint. Replaces the old
 * AdminKeyGuard, which was one shared secret for everybody and could not be
 * revoked without redeploying the API.
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly auth: AdminAuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AdminRequest>();
    const header = req.header('authorization') ?? '';
    const [scheme, token] = header.split(' ');

    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const user = await this.auth.resolve(token);
    if (!user) throw new UnauthorizedException('Session expired or invalid');

    req.adminUser = user;
    return true;
  }
}
