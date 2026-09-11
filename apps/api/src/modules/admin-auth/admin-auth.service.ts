import {
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AdminUser } from '@prisma/client';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { createHash, randomBytes } from 'node:crypto';

import { PrismaService } from '../../common/prisma/prisma.service';

/** the claims we actually rely on, beyond the registered ones jose checks */
type GoogleClaims = JWTPayload & {
  email?: string;
  email_verified?: boolean;
  name?: string;
};

@Injectable()
export class AdminAuthService implements OnModuleInit {
  private readonly logger = new Logger(AdminAuthService.name);
  private jwks!: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    // createRemoteJWKSet caches the key set and refetches on an unknown `kid`,
    // so this is built once rather than per request
    this.jwks = createRemoteJWKSet(new URL(this.config.get<string>('google.jwksUrl')!));
  }

  /**
   * Verifies a Google ID token and mints a session for the matching staff
   * account. The session token is returned exactly once - only its sha256 is
   * written, so the sessions table is useless to anyone who reads it.
   *
   * No account is ever created here. `admin_users` IS the allowlist: a valid
   * Google identity with no row is simply refused, which is what keeps "anyone
   * with a Gmail account" from being a login.
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
    // address could claim any email, including one on the allowlist.
    if (claims.email_verified !== true || !claims.email) {
      throw new UnauthorizedException('That Google account has no verified email');
    }

    const email = claims.email.trim().toLowerCase();
    const sub = claims.sub;
    const user = await this.prisma.adminUser.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      this.logger.warn(`Google sign-in refused for "${email}" from ${meta.ip ?? 'unknown ip'}`);
      throw new ForbiddenException('This account is not allowed in the back office');
    }

    // First sign-in binds the account to a Google subject; later ones must match
    // it, so a recycled or spoofed address cannot take over an existing row.
    if (user.googleSub && sub && user.googleSub !== sub) {
      this.logger.error(`Google sub mismatch for "${email}" - refusing`);
      throw new ForbiddenException('This account is bound to a different Google identity');
    }

    const token = randomBytes(32).toString('base64url');
    const ttlHours = this.config.get<number>('adminSessionTtlHours') ?? 12;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);

    const updated = await this.prisma.$transaction(async (tx) => {
      // The isActive check above is a read, and an owner can deactivate this
      // account between it and the session insert - leaving a session minted
      // for someone who no longer has access. So the account row is written
      // first, only while it is still active: that write locks the row, a
      // deactivation that committed in between turns it into a no-op here, and
      // one still in flight has to wait for this transaction and then deletes
      // the session it created (StaffService ends sessions in the same
      // Serializable transaction as the flag).
      const { count } = await tx.adminUser.updateMany({
        where: { id: user.id, isActive: true },
        data: {
          lastLoginAt: now,
          googleSub: user.googleSub ?? sub,
          // Google is the source of truth for the display name, but never for
          // the role - that is ours to decide
          name: user.name ?? claims.name ?? null,
        },
      });
      if (count === 0) {
        this.logger.warn(`Google sign-in refused for "${email}": deactivated while signing in`);
        throw new ForbiddenException('This account is not allowed in the back office');
      }

      await tx.adminSession.create({
        data: {
          tokenHash: sha256(token),
          userId: user.id,
          expiresAt,
          userAgent: meta.userAgent?.slice(0, 500),
          ip: meta.ip,
        },
      });
      // opportunistic sweep - expired rows are dead weight and there is no cron
      await tx.adminSession.deleteMany({ where: { expiresAt: { lt: now } } });

      return tx.adminUser.findUniqueOrThrow({ where: { id: user.id } });
    });

    return { token, expiresAt, user: toDto(updated) };
  }

  /**
   * Resolves a bearer token to its account, or null. The lookup is by unique
   * index on the hash, so there is no secret-dependent comparison to time.
   */
  async resolve(token: string) {
    const session = await this.prisma.adminSession.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: true },
    });

    if (!session) return null;
    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.adminSession.delete({ where: { id: session.id } }).catch(() => {
        // a concurrent request may have swept it already
      });
      return null;
    }
    if (!session.user.isActive) return null;

    return session.user;
  }

  async logout(token: string) {
    await this.prisma.adminSession
      .delete({ where: { tokenHash: sha256(token) } })
      .catch(() => {
        // already gone - signing out twice is not an error worth surfacing
      });
    return { ok: true };
  }
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function toDto(user: AdminUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    lastLoginAt: user.lastLoginAt,
  };
}
