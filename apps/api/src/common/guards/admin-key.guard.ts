import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/**
 * Minimal shared-secret gate for the back-office endpoints (order status changes,
 * quote triage, catalog writes). Swap for real auth before this sees customers.
 */
@Injectable()
export class AdminKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const expected = this.config.get<string>('adminKey');
    if (!expected) {
      throw new UnauthorizedException('ADMIN_API_KEY is not configured');
    }
    const req = ctx.switchToHttp().getRequest<Request>();
    const got = req.header('x-admin-key');
    if (!got || got !== expected) {
      throw new UnauthorizedException('Invalid admin key');
    }
    return true;
  }
}
