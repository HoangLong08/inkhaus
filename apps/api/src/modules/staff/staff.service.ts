import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  type HttpException,
} from '@nestjs/common';
import { AdminRole, Prisma } from '@prisma/client';
import { staffChangeError, type StaffChangeErrorCode } from '@inkhaus/shared';

import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { InviteStaffDto } from './dto/invite-staff.dto';
import type { UpdateStaffDto } from './dto/update-staff.dto';
import {
  normalizeStaffEmail,
  planStaffChange,
  plural,
  STAFF_AUDIT_ENTITY,
  summarizeStaffChange,
} from './staff.plan';

/** one row of GET /admin/staff/directory - the admin app parses exactly this shape */
export type StaffDirectoryEntry = {
  id: string;
  name: string | null;
  email: string;
  role: AdminRole;
};

/** who is asking: the guard's user, of which only these two fields matter here */
export type StaffActor = { id: string; role: AdminRole };

/** one row of GET /admin/staff - the admin app parses exactly this shape */
export type StaffMember = {
  id: string;
  email: string;
  name: string | null;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  deactivatedAt: Date | null;
  /** null for the seed's bootstrap owners */
  invitedBy: { id: string; name: string | null; email: string } | null;
  /** unexpired sessions - how many devices a deactivation would sign out */
  activeSessions: number;
  isSelf: boolean;
};

export type StaffList = { data: StaffMember[]; activeOwners: number };

export const STAFF_RACE_MESSAGE = 'Someone else changed staff at the same time — try again.';
export const STAFF_REVOKE_SELF_MESSAGE = 'You cannot end your own sessions here — use Sign out.';

const ACTIVE_OWNERS = {
  role: AdminRole.OWNER,
  isActive: true,
} satisfies Prisma.AdminUserWhereInput;

/** active accounts first, owners before staff (the enum's order), then by name */
const MEMBER_ORDER = [
  { isActive: 'desc' },
  { role: 'asc' },
  { name: { sort: 'asc', nulls: 'last' } },
  { email: 'asc' },
] satisfies Prisma.AdminUserOrderByWithRelationInput[];

/** a row as the staff screen shows it; `now` decides which sessions are still live */
function memberSelect(now: Date) {
  return {
    id: true,
    email: true,
    name: true,
    role: true,
    isActive: true,
    lastLoginAt: true,
    createdAt: true,
    deactivatedAt: true,
    invitedBy: { select: { id: true, name: true, email: true } },
    _count: { select: { sessions: { where: { expiresAt: { gt: now } } } } },
  } satisfies Prisma.AdminUserSelect;
}

type MemberRow = Prisma.AdminUserGetPayload<{ select: ReturnType<typeof memberSelect> }>;

/**
 * How each refusal from `staffChangeError` answers. SELF is the caller's own
 * mistake, LAST_OWNER a conflict with the state the office is in, NOT_OWNER a
 * permission. The admin's BFF maps them the same way.
 */
const REFUSALS: Record<StaffChangeErrorCode, new (message: string) => HttpException> = {
  SELF: BadRequestException,
  LAST_OWNER: ConflictException,
  NOT_OWNER: ForbiddenException,
};

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Every active admin, for pickers and labels - who a quote can be assigned
   * to, whose name goes beside a timeline entry. Any role may read it
   * (`orders.view`), so it is deliberately thin: nothing the staff screen keeps
   * to owners, no sign-in times, no sessions, no deactivated accounts.
   */
  directory(): Promise<StaffDirectoryEntry[]> {
    return this.prisma.adminUser.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: [{ name: { sort: 'asc', nulls: 'last' } }, { email: 'asc' }],
    });
  }

  /**
   * Every account, active or not - the whole sign-in allowlist. Not paginated:
   * it is one office's staff. `activeOwners` rides along so the screen can
   * disable what `staffChangeError` would refuse without asking twice.
   */
  async list(actor: StaffActor): Promise<StaffList> {
    const now = new Date();
    const [rows, activeOwners] = await this.prisma.$transaction([
      this.prisma.adminUser.findMany({ select: memberSelect(now), orderBy: MEMBER_ORDER }),
      this.prisma.adminUser.count({ where: ACTIVE_OWNERS }),
    ]);
    return { data: rows.map((row) => this.toDto(row, actor.id)), activeOwners };
  }

  /**
   * Adds an address to the allowlist. Nothing is sent (decision D15): the
   * person signs in with Google using exactly this address, and the first
   * sign-in binds the row to their Google identity.
   */
  async invite(actor: StaffActor, input: InviteStaffDto): Promise<StaffMember> {
    const email = normalizeStaffEmail(input.email);
    const name = input.name?.trim() || null;
    const role = input.role ?? AdminRole.STAFF;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.adminUser.findUnique({ where: { email }, select: { id: true } });
        if (existing) throw new ConflictException(alreadyListed(email));

        const row = await tx.adminUser.create({
          data: { email, name, role, invitedById: actor.id },
          select: memberSelect(new Date()),
        });
        await this.audit.record(tx, {
          actorId: actor.id,
          action: 'staff.invite',
          entity: STAFF_AUDIT_ENTITY,
          entityId: row.id,
          summary: `Invited ${email} as ${role.toLowerCase()}`,
          after: { email, name, role },
        });
        return this.toDto(row, actor.id);
      });
    } catch (err) {
      // two owners adding the same address at once: the unique index settles
      // it, and the loser gets the same answer as if they had been second
      if (isPrismaError(err, 'P2002')) throw new ConflictException(alreadyListed(email));
      throw err;
    }
  }

  /**
   * Renames, promotes, demotes, deactivates or reactivates one account - the
   * only code that does, so every such change is checked and logged the same
   * way.
   *
   * Serializable, because the rule that matters most here is about the whole
   * table, not one row: at least one active owner must remain. Two owners
   * demoting each other at the same moment would each count two owners, each
   * pass, and leave none. Under Serializable the second commit is refused (a
   * P2034), and the caller is told to try again - when the retry counts again,
   * `staffChangeError` refuses it properly.
   *
   * Deactivating deletes the account's sessions in the same transaction.
   * AdminAuthService.resolve already refuses an inactive user on every request,
   * so the deactivation takes effect on the next one either way; deleting the
   * rows means no live token is left lying around to become valid again on a
   * reactivation.
   */
  async update(actor: StaffActor, id: string, change: UpdateStaffDto): Promise<StaffMember> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const now = new Date();

          // Read again inside the transaction rather than trusting the guard's
          // copy, which is from the start of the request: an owner demoted or
          // deactivated since must not finish a change on the way out, and the
          // read is what puts their own row under the isolation level too.
          const me = await tx.adminUser.findUnique({
            where: { id: actor.id },
            select: { id: true, role: true, isActive: true },
          });
          if (!me?.isActive) throw new ForbiddenException('Your account is no longer active.');

          const target = await tx.adminUser.findUnique({ where: { id }, select: memberSelect(now) });
          if (!target) throw new NotFoundException(`No staff account "${id}"`);

          const activeOwners = await tx.adminUser.count({ where: ACTIVE_OWNERS });
          const refusal = staffChangeError(me, target, change, activeOwners);
          if (refusal) throw new REFUSALS[refusal.code](refusal.message);

          const plan = planStaffChange(target, change, now);
          if (!plan) return this.toDto(target, actor.id);

          let sessionsEnded = 0;
          if (plan.endSessions) {
            ({ count: sessionsEnded } = await tx.adminSession.deleteMany({ where: { userId: id } }));
          }

          const row = await tx.adminUser.update({
            where: { id },
            data: plan.data,
            select: memberSelect(now),
          });
          await this.audit.record(tx, {
            actorId: actor.id,
            action: plan.action,
            entity: STAFF_AUDIT_ENTITY,
            entityId: id,
            summary: summarizeStaffChange(target.email, plan, sessionsEnded),
            before: plan.before,
            after: plan.after,
          });
          return this.toDto(row, actor.id);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      if (isPrismaError(err, 'P2034')) throw new ConflictException(STAFF_RACE_MESSAGE);
      throw err;
    }
  }

  /**
   * Signs someone out everywhere without touching their access - a lost
   * laptop, a shared machine. Not for yourself: that is what Sign out is for,
   * and doing it here would pull the session out from under this very request.
   */
  async revokeSessions(actor: StaffActor, id: string): Promise<{ revoked: number }> {
    if (id === actor.id) throw new BadRequestException(STAFF_REVOKE_SELF_MESSAGE);

    return this.prisma.$transaction(async (tx) => {
      const target = await tx.adminUser.findUnique({
        where: { id },
        select: { id: true, email: true },
      });
      if (!target) throw new NotFoundException(`No staff account "${id}"`);

      const { count } = await tx.adminSession.deleteMany({ where: { userId: id } });
      // nothing ended is nothing changed, and the log is a record of changes
      if (count > 0) {
        await this.audit.record(tx, {
          actorId: actor.id,
          action: 'staff.revoke_sessions',
          entity: STAFF_AUDIT_ENTITY,
          entityId: id,
          summary: `Ended ${plural(count, 'session')} for ${target.email}`,
          after: { revoked: count },
        });
      }
      return { revoked: count };
    });
  }

  private toDto(row: MemberRow, actorId: string): StaffMember {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      isActive: row.isActive,
      lastLoginAt: row.lastLoginAt,
      createdAt: row.createdAt,
      deactivatedAt: row.deactivatedAt,
      invitedBy: row.invitedBy,
      activeSessions: row._count.sessions,
      isSelf: row.id === actorId,
    };
  }
}

function alreadyListed(email: string) {
  return `${email} is already on the staff list.`;
}

function isPrismaError(err: unknown, code: string) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;
}
