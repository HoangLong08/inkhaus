import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { STAFF_REVOKE_SELF_MESSAGE } from '@inkhaus/shared';

import type { AuditService } from '../../common/audit/audit.service';
import type { PrismaService } from '../../common/prisma/prisma.service';
import { planStaffChange } from './staff.plan';
import { STAFF_RACE_MESSAGE, StaffService } from './staff.service';

type Row = {
  id: string;
  email: string;
  name: string | null;
  role: 'OWNER' | 'STAFF';
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  deactivatedAt: Date | null;
  invitedBy: { id: string; name: string | null; email: string } | null;
  _count: { sessions: number };
};

const CREATED = new Date('2026-09-01T10:00:00Z');

function account(id: string, over: Partial<Row> = {}): Row {
  return {
    id,
    email: `${id}@inkhaus.test`,
    name: null,
    role: 'STAFF',
    isActive: true,
    lastLoginAt: null,
    createdAt: CREATED,
    deactivatedAt: null,
    invitedBy: null,
    _count: { sessions: 2 },
    ...over,
  };
}

const OWNER = account('owner-1', { role: 'OWNER' });
const OTHER_OWNER = account('owner-2', { role: 'OWNER' });
const STAFF = account('staff-1');

const knownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(`simulated ${code}`, { code, clientVersion: 'test' });

/**
 * A Prisma stand-in. The interactive transaction hands its callback `tx`, a
 * set of mocks separate from the client's own, so a test can tell a write made
 * inside the transaction from one made beside it. `commitFails` runs the work
 * and then refuses the commit, which is where Postgres reports a serialization
 * failure.
 */
function setup(
  rows: Row[],
  { activeOwners, commitFails }: { activeOwners?: number; commitFails?: Error } = {},
) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const owners = activeOwners ?? rows.filter((r) => r.role === 'OWNER' && r.isActive).length;

  const delegates = () => ({
    adminUser: {
      findUnique: jest.fn(async ({ where }: { where: { id?: string; email?: string } }) =>
        (where.id ? byId.get(where.id) : rows.find((r) => r.email === where.email)) ?? null,
      ),
      findMany: jest.fn().mockResolvedValue(rows),
      count: jest.fn().mockResolvedValue(owners),
      create: jest.fn(async ({ data }: { data: Partial<Row> & { invitedById: string } }) => {
        const { invitedById, ...fields } = data;
        return account('new-1', {
          ...fields,
          invitedBy: { id: invitedById, name: null, email: `${invitedById}@inkhaus.test` },
          _count: { sessions: 0 },
        });
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => ({
        ...byId.get(where.id)!,
        ...data,
      })),
    },
    adminSession: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
  });

  const tx = delegates();
  const client = delegates();
  const prisma = {
    ...client,
    $transaction: jest.fn(async (arg: unknown) => {
      if (typeof arg !== 'function') return Promise.all(arg as Promise<unknown>[]);
      const result = await arg(tx);
      if (commitFails) throw commitFails;
      return result;
    }),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new StaffService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
  );

  const wrote = () =>
    tx.adminUser.update.mock.calls.length +
    tx.adminSession.deleteMany.mock.calls.length +
    audit.record.mock.calls.length;

  return { service, prisma, tx, client, audit, wrote };
}

describe('StaffService.update', () => {
  it('deactivates in one Serializable transaction that also ends every session', async () => {
    const { service, prisma, tx, client, audit } = setup([OWNER, OTHER_OWNER, STAFF]);

    const member = await service.update(OWNER, STAFF.id, { isActive: false });

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    // inside the transaction, never beside it
    expect(tx.adminSession.deleteMany).toHaveBeenCalledWith({ where: { userId: STAFF.id } });
    expect(client.adminSession.deleteMany).not.toHaveBeenCalled();
    expect(tx.adminUser.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: STAFF.id },
        data: { isActive: false, deactivatedAt: expect.any(Date) },
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        actorId: OWNER.id,
        action: 'staff.deactivate',
        entity: 'admin_user',
        entityId: STAFF.id,
        summary: `Deactivated ${STAFF.email} and ended 2 sessions`,
        before: { isActive: true },
        after: { isActive: false },
      }),
    );
    expect(member).toMatchObject({ id: STAFF.id, isActive: false, isSelf: false });
  });

  it('reactivates: clears deactivatedAt and has no sessions to end', async () => {
    const gone = account('staff-2', { isActive: false, deactivatedAt: CREATED });
    const { service, tx, audit } = setup([OWNER, gone]);

    await service.update(OWNER, gone.id, { isActive: true });

    expect(tx.adminUser.update.mock.calls[0][0].data).toEqual({
      isActive: true,
      deactivatedAt: null,
    });
    expect(tx.adminSession.deleteMany).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: 'staff.reactivate' }),
    );
  });

  it('logs a role change as staff.update, with the role as it was and as it is', async () => {
    const { service, tx, audit } = setup([OWNER, STAFF]);

    await service.update(OWNER, STAFF.id, { role: 'OWNER' });

    expect(tx.adminUser.update.mock.calls[0][0].data).toEqual({ role: 'OWNER' });
    expect(tx.adminSession.deleteMany).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: 'staff.update',
        before: { role: 'STAFF' },
        after: { role: 'OWNER' },
      }),
    );
  });

  it('refuses to lose the last active owner with a 409, before writing anything', async () => {
    // Only reachable through a race - the caller is an active owner, so there
    // are always two - or data the guard would already refuse. It is pinned
    // anyway, because it is the rule that keeps the office from locking itself
    // out, and the count it relies on is the one taken inside the transaction.
    const { service, wrote } = setup([OWNER, OTHER_OWNER], { activeOwners: 1 });

    await expect(service.update(OWNER, OTHER_OWNER.id, { role: 'STAFF' })).rejects.toThrow(
      ConflictException,
    );
    await expect(service.update(OWNER, OTHER_OWNER.id, { isActive: false })).rejects.toThrow(
      'At least one active owner must remain.',
    );
    expect(wrote()).toBe(0);
  });

  it('refuses changing your own role or deactivating yourself with a 400', async () => {
    const { service, wrote } = setup([OWNER, OTHER_OWNER]);

    await expect(service.update(OWNER, OWNER.id, { role: 'STAFF' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.update(OWNER, OWNER.id, { isActive: false })).rejects.toThrow(
      BadRequestException,
    );
    expect(wrote()).toBe(0);
  });

  it('lets you rename yourself - only role and access are off limits', async () => {
    const { service, tx } = setup([OWNER, OTHER_OWNER]);

    await service.update(OWNER, OWNER.id, { name: '  Hoang  ' });
    expect(tx.adminUser.update.mock.calls[0][0].data).toEqual({ name: 'Hoang' });
  });

  it('refuses a caller who is no longer an owner with a 403, whatever the guard loaded', async () => {
    // the guard's copy says OWNER; the row, read inside the transaction, says STAFF
    const demoted = account('owner-1', { role: 'STAFF' });
    const { service, wrote } = setup([demoted, OTHER_OWNER, STAFF]);

    await expect(service.update(OWNER, STAFF.id, { role: 'OWNER' })).rejects.toThrow(
      ForbiddenException,
    );
    expect(wrote()).toBe(0);
  });

  it('refuses a caller deactivated since the guard ran', async () => {
    const deactivated = account('owner-1', { role: 'OWNER', isActive: false });
    const { service, wrote } = setup([deactivated, OTHER_OWNER, STAFF]);

    await expect(service.update(OWNER, STAFF.id, { isActive: false })).rejects.toThrow(
      ForbiddenException,
    );
    expect(wrote()).toBe(0);
  });

  it('answers 409 with a retry message when the database refuses to serialise it', async () => {
    const { service } = setup([OWNER, OTHER_OWNER, STAFF], { commitFails: knownError('P2034') });

    const attempt = service.update(OWNER, OTHER_OWNER.id, { role: 'STAFF' });
    await expect(attempt).rejects.toThrow(ConflictException);
    await expect(attempt).rejects.toThrow(STAFF_RACE_MESSAGE);
  });

  it('lets any other failure through as it was', async () => {
    const boom = new Error('connection reset');
    const { service } = setup([OWNER, STAFF], { commitFails: boom });

    await expect(service.update(OWNER, STAFF.id, { role: 'OWNER' })).rejects.toBe(boom);
  });

  it('answers 404 for an account that does not exist', async () => {
    const { service } = setup([OWNER]);
    await expect(service.update(OWNER, 'nobody', { role: 'OWNER' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('writes nothing, and logs nothing, when nothing would change', async () => {
    const { service, wrote } = setup([OWNER, STAFF]);

    await expect(
      service.update(OWNER, STAFF.id, { role: 'STAFF', isActive: true }),
    ).resolves.toMatchObject({ id: STAFF.id, role: 'STAFF', isActive: true });
    expect(wrote()).toBe(0);
  });
});

describe('StaffService.invite', () => {
  it('adds the address as sign-in will compare it, with who invited them, and logs it', async () => {
    const { service, tx, audit } = setup([OWNER]);

    const member = await service.invite(OWNER, {
      email: '  New.Person@Inkhaus.TEST ',
      name: ' New Person ',
      role: 'STAFF',
    });

    expect(tx.adminUser.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          email: 'new.person@inkhaus.test',
          name: 'New Person',
          role: 'STAFF',
          invitedById: OWNER.id,
        },
      }),
    );
    expect(member).toMatchObject({
      email: 'new.person@inkhaus.test',
      invitedBy: { id: OWNER.id },
      activeSessions: 0,
      isSelf: false,
    });
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: 'staff.invite', entityId: 'new-1', actorId: OWNER.id }),
    );
  });

  it('refuses an address that is already on the list with a 409, in any case', async () => {
    const { service, tx, audit } = setup([OWNER, STAFF]);

    await expect(
      service.invite(OWNER, { email: STAFF.email.toUpperCase(), role: 'STAFF' }),
    ).rejects.toThrow(ConflictException);
    expect(tx.adminUser.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('gives the same 409 when a concurrent invite wins the unique index', async () => {
    const { service, tx } = setup([OWNER]);
    tx.adminUser.create.mockRejectedValueOnce(knownError('P2002'));

    await expect(
      service.invite(OWNER, { email: 'race@inkhaus.test', role: 'STAFF' }),
    ).rejects.toThrow('race@inkhaus.test is already on the staff list.');
  });
});

describe('StaffService.revokeSessions', () => {
  it('refuses your own sessions with a 400 - that is what signing out is for', async () => {
    const { service, prisma } = setup([OWNER]);

    await expect(service.revokeSessions(OWNER, OWNER.id)).rejects.toThrow(
      new BadRequestException(STAFF_REVOKE_SELF_MESSAGE),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("ends every one of someone else's sessions and logs how many", async () => {
    const { service, tx, audit } = setup([OWNER, STAFF]);

    await expect(service.revokeSessions(OWNER, STAFF.id)).resolves.toEqual({ revoked: 2 });
    expect(tx.adminSession.deleteMany).toHaveBeenCalledWith({ where: { userId: STAFF.id } });
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: 'staff.revoke_sessions', after: { revoked: 2 } }),
    );
  });

  it('logs nothing when there was nothing to end', async () => {
    const { service, tx, audit } = setup([OWNER, STAFF]);
    tx.adminSession.deleteMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.revokeSessions(OWNER, STAFF.id)).resolves.toEqual({ revoked: 0 });
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('answers 404 for an account that does not exist', async () => {
    const { service } = setup([OWNER]);
    await expect(service.revokeSessions(OWNER, 'nobody')).rejects.toThrow(NotFoundException);
  });
});

describe('StaffService.list', () => {
  it('flags the caller, counts only unexpired sessions and reports the active owners', async () => {
    const { service, client } = setup([OWNER, STAFF]);

    const list = await service.list(OWNER);

    expect(list.activeOwners).toBe(1);
    expect(list.data.map((m) => [m.id, m.isSelf, m.activeSessions])).toEqual([
      [OWNER.id, true, 2],
      [STAFF.id, false, 2],
    ]);
    const { select, orderBy } = client.adminUser.findMany.mock.calls[0][0];
    expect(select._count).toEqual({
      select: { sessions: { where: { expiresAt: { gt: expect.any(Date) } } } },
    });
    expect(orderBy[0]).toEqual({ isActive: 'desc' });
  });
});

describe('planStaffChange', () => {
  const current = { name: 'Jo', role: 'STAFF' as const, isActive: true };
  const now = new Date('2026-09-11T12:00:00Z');

  it('clears a blank name and treats an unchanged one as no change at all', () => {
    expect(planStaffChange(current, { name: '   ' }, now)?.data).toEqual({ name: null });
    expect(planStaffChange(current, { name: ' Jo ' }, now)).toBeNull();
    expect(planStaffChange(current, {}, now)).toBeNull();
  });

  it('names the entry after the weightiest part of the request', () => {
    const plan = planStaffChange(current, { role: 'OWNER', isActive: false }, now);
    expect(plan).toMatchObject({
      action: 'staff.deactivate',
      endSessions: true,
      data: { role: 'OWNER', isActive: false, deactivatedAt: now },
      before: { role: 'STAFF', isActive: true },
      after: { role: 'OWNER', isActive: false },
    });
  });
});
