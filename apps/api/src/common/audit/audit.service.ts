import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

/** anything with an `adminAuditLog` delegate - the service itself or a transaction */
export type AuditClient = Prisma.TransactionClient | PrismaService;

export type AuditEntry = {
  /** the staff member who made the change */
  actorId: string | null;
  /** dotted verb - product.update, tiers.replace, staff.deactivate, orders.export */
  action: string;
  /** product | color | size | price_tiers | review | customer | admin_user | orders */
  entity: string;
  entityId: string;
  /** one line a person can read in a history card */
  summary?: string | null;
  /**
   * The fields that changed, as they were and as they are. Anything JSON can
   * carry: Dates and Decimals are stored as the strings they serialise to.
   * Never a secret - the log is shown to owners in full.
   */
  before?: unknown;
  after?: unknown;
};

export type AuditRecord = {
  id: string;
  action: string;
  summary: string | null;
  before: Prisma.JsonValue | null;
  after: Prisma.JsonValue | null;
  at: Date;
  actor: { id: string; name: string | null; email: string } | null;
};

/**
 * The append-only log for back-office changes that have no timeline of their
 * own - catalog, prices, staff, customer edits, exports. Orders and quotes keep
 * their history in their own event tables instead.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Appends one entry. Takes the client explicitly so a caller writes it in the
   * same transaction as the change it describes: a change that commits without
   * its entry, or an entry for a change that rolled back, is worse than no log.
   */
  async record(client: AuditClient, entry: AuditEntry): Promise<void> {
    await client.adminAuditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        summary: entry.summary ?? null,
        before: toJson(entry.before),
        after: toJson(entry.after),
      },
    });
  }

  /** the latest `take` entries for one record, newest first */
  async history(entity: string, entityId: string, take = 10): Promise<AuditRecord[]> {
    const rows = await this.prisma.adminAuditLog.findMany({
      where: { entity, entityId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      select: {
        id: true,
        action: true,
        summary: true,
        before: true,
        after: true,
        createdAt: true,
        actor: { select: { id: true, name: true, email: true } },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      summary: r.summary,
      before: r.before,
      after: r.after,
      at: r.createdAt,
      actor: r.actor,
    }));
  }
}

/**
 * undefined and null leave the column NULL. Everything else goes through a JSON
 * round trip, which turns a Date or a Decimal into the string the API would
 * have sent anyway - Prisma refuses both as a Json input.
 */
function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  const text = JSON.stringify(value);
  return text === undefined ? undefined : (JSON.parse(text) as Prisma.InputJsonValue);
}
