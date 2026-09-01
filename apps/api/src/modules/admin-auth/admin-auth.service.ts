import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hash, verify } from '@node-rs/argon2';
import type { AdminUser } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';

import { PrismaService } from '../../common/prisma/prisma.service';
import type { LoginDto } from './dto/login.dto';

/**
 * argon2id hash of a random value nobody will ever type. `login` verifies
 * against it when the email does not exist, so a missing account burns the same
 * milliseconds as a wrong password and the response time stops being a user
 * enumeration oracle. Computed once, lazily - a hardcoded literal risks being
 * rejected by the parser instantly, which is exactly the timing tell we are
 * trying to remove.
 */
let dummyHash: Promise<string> | null = null;
function decoyHash() {
  dummyHash ??= hash(randomBytes(32).toString('hex'));
  return dummyHash;
}

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** the one place a password becomes a hash - used by login checks and the seed */
  static hashPassword(password: string) {
    return hash(password);
  }

  /**
   * Verifies the credentials and mints an opaque session token. The token is
   * returned exactly once - only its sha256 is written, so the sessions table is
   * useless to anyone who reads it.
   */
  async login(dto: LoginDto, meta: { userAgent?: string; ip?: string }) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.adminUser.findUnique({ where: { email } });

    const ok = await verify(user?.passwordHash ?? (await decoyHash()), dto.password).catch(
      () => false,
    );

    if (!user || !ok || !user.isActive) {
      this.logger.warn(`Failed admin login for "${email}" from ${meta.ip ?? 'unknown ip'}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = randomBytes(32).toString('base64url');
    const ttlHours = this.config.get<number>('adminSessionTtlHours') ?? 12;
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    await this.prisma.$transaction([
      this.prisma.adminSession.create({
        data: {
          tokenHash: sha256(token),
          userId: user.id,
          expiresAt,
          userAgent: meta.userAgent?.slice(0, 500),
          ip: meta.ip,
        },
      }),
      this.prisma.adminUser.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
      // opportunistic sweep - expired rows are dead weight and there is no cron
      this.prisma.adminSession.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    ]);

    return { token, expiresAt, user: toDto(user) };
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
