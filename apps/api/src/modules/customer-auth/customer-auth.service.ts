import { Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Customer } from '@prisma/client';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { createHash, randomBytes } from 'node:crypto';

import { PrismaService } from '../../common/prisma/prisma.service';

/** the claims we actually rely on, beyond the registered ones jose checks */
type GoogleClaims = JWTPayload & {
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

@Injectable()
export class CustomerAuthService implements OnModuleInit {
  private readonly logger = new Logger(CustomerAuthService.name);
  private jwks!: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    // Same key set as the back office, and deliberately a second instance
    // rather than a shared one: this module must not import AdminAuthModule
    // just to borrow a cache, or the storefront ends up one typo away from
    // resolving staff tokens.
    this.jwks = createRemoteJWKSet(new URL(this.config.get<string>('google.jwksUrl')!));
  }

  /**
   * Verifies a Google ID token and mints a storefront session.
   *
   * The one real difference from the back office: this DOES create an account.
   * `admin_users` is an allowlist, `customers` is not - anyone with a Google
   * account may shop, and refusing an unknown address here would mean a sign-in
   * button that only works for people who have already ordered.
   *
   * Matching is by email rather than by `sub` on purpose. A guest checkout has
   * already filed orders under that address, and Google has just proved the
   * person owns it, so the account they sign into should be that same row.
   */
  async loginWithGoogle(idToken: string, meta: { userAgent?: string; ip?: string }) {
    const clientId = this.config.get<string>('google.clientId');
    if (!clientId) {
      // a blank audience would make `aud` unverifiable - fail loudly rather
      // than accepting tokens minted for some other application
      this.logger.error('GOOGLE_CLIENT_ID is not configured; refusing to verify id tokens');
      throw new UnauthorizedException('Google sign-in is not configured');
    }

    let claims: GoogleClaims;
    try {
      const { payload } = await jwtVerify(idToken, this.jwks, {
        issuer: this.config.get<string>('google.issuer'),
        audience: clientId,
      });
      claims = payload as GoogleClaims;
    } catch (err) {
      this.logger.warn(`Rejected Google id token: ${(err as Error).message}`);
      throw new UnauthorizedException('Invalid Google sign-in');
    }

    // Without this, a Workspace domain that lets users set an unverified
    // address could claim someone else's order history.
    if (claims.email_verified !== true || !claims.email) {
      throw new UnauthorizedException('That Google account has no verified email');
    }

    const email = claims.email.trim().toLowerCase();
    const sub = claims.sub ?? null;

    const existing = await this.prisma.customer.findUnique({ where: { email } });

    // First sign-in binds the row to a Google subject; later ones must match it,
    // so a recycled address cannot take over the orders of the person who had
    // it before.
    if (existing?.googleSub && sub && existing.googleSub !== sub) {
      this.logger.error(`Google sub mismatch for customer "${email}" - refusing`);
      throw new UnauthorizedException('This account is bound to a different Google identity');
    }

    const customer = await this.prisma.customer.upsert({
      where: { email },
      update: {
        googleSub: existing?.googleSub ?? sub,
        // Google is the source of truth for the display name and picture, but
        // only to fill blanks - a name typed at checkout is the one the person
        // chose for us and outlives whatever their Google profile says today.
        name: existing?.name ?? claims.name ?? null,
        avatarUrl: claims.picture ?? null,
        lastLoginAt: new Date(),
      },
      create: {
        email,
        googleSub: sub,
        name: claims.name ?? null,
        avatarUrl: claims.picture ?? null,
        lastLoginAt: new Date(),
      },
    });

    const token = randomBytes(32).toString('base64url');
    const ttlDays = this.config.get<number>('customerSessionTtlDays') ?? 30;
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    await this.prisma.$transaction([
      this.prisma.customerSession.create({
        data: {
          tokenHash: sha256(token),
          customerId: customer.id,
          expiresAt,
          userAgent: meta.userAgent?.slice(0, 500),
          ip: meta.ip,
        },
      }),
      // opportunistic sweep - expired rows are dead weight and there is no cron
      this.prisma.customerSession.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    ]);

    return { token, expiresAt, customer: toDto(customer) };
  }

  /**
   * Resolves a bearer token to its customer, or null. The lookup is by unique
   * index on the hash, so there is no secret-dependent comparison to time.
   */
  async resolve(token: string) {
    const session = await this.prisma.customerSession.findUnique({
      where: { tokenHash: sha256(token) },
      include: { customer: true },
    });

    if (!session) return null;
    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.customerSession.delete({ where: { id: session.id } }).catch(() => {
        // a concurrent request may have swept it already
      });
      return null;
    }

    return session.customer;
  }

  async logout(token: string) {
    await this.prisma.customerSession.delete({ where: { tokenHash: sha256(token) } }).catch(() => {
      // already gone - signing out twice is not an error worth surfacing
    });
    return { ok: true };
  }
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * What the storefront is allowed to know about the signed-in shopper. Notably
 * not `id`: every customer-scoped route reads the id from the session, so
 * exposing it would only invite a client to start passing it around.
 */
export function toDto(customer: Customer) {
  return {
    email: customer.email,
    name: customer.name,
    avatarUrl: customer.avatarUrl,
    phone: customer.phone,
    company: customer.company,
  };
}
