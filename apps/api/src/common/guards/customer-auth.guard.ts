import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Customer } from '@prisma/client';
import type { Request } from 'express';

import { CustomerAuthService } from '../../modules/customer-auth/customer-auth.service';

/** what the guard hangs off the request once a token checks out */
export type CustomerRequest = Request & { customer?: Customer };

/**
 * Bearer-token gate for the storefront's account routes.
 *
 * Deliberately a separate guard from AdminAuthGuard rather than one that
 * accepts either: a route protected by "some valid session" is a route where
 * the next person to add a `req.customer!` gets a staff account instead.
 */
@Injectable()
export class CustomerAuthGuard implements CanActivate {
  constructor(private readonly auth: CustomerAuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<CustomerRequest>();
    const header = req.header('authorization') ?? '';
    const [scheme, token] = header.split(' ');

    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const customer = await this.auth.resolve(token);
    if (!customer) throw new UnauthorizedException('Session expired or invalid');

    req.customer = customer;
    return true;
  }
}
