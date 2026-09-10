import { ForbiddenException, Logger, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { Can } from '../decorators/can.decorator';
import { CapabilityGuard } from './capability.guard';

class OrdersRoutes {
  @Can('orders.view')
  list() {}

  @Can('orders.export')
  exportCsv() {}

  /** the mistake the guard exists to catch */
  forgotten() {}
}

@Can('stats.view')
class StatsRoutes {
  overview() {}

  @Can('staff.manage')
  manage() {}
}

function context(cls: object, handler: object, role?: 'OWNER' | 'STAFF') {
  const req = { adminUser: role ? { id: 'admin-1', role } : undefined };
  return {
    getClass: () => cls,
    getHandler: () => handler,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('CapabilityGuard', () => {
  const guard = new CapabilityGuard(new Reflector());

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('lets through a role the capability lists', () => {
    const list = OrdersRoutes.prototype.list;
    expect(guard.canActivate(context(OrdersRoutes, list, 'STAFF'))).toBe(true);
    expect(guard.canActivate(context(OrdersRoutes, list, 'OWNER'))).toBe(true);
  });

  it('refuses staff an owner-only capability', () => {
    const exportCsv = OrdersRoutes.prototype.exportCsv;
    expect(() => guard.canActivate(context(OrdersRoutes, exportCsv, 'STAFF'))).toThrow(
      ForbiddenException,
    );
    expect(guard.canActivate(context(OrdersRoutes, exportCsv, 'OWNER'))).toBe(true);
  });

  it('refuses a handler that declares nothing, even to an owner', () => {
    const forgotten = OrdersRoutes.prototype.forgotten;
    expect(() => guard.canActivate(context(OrdersRoutes, forgotten, 'OWNER'))).toThrow(
      ForbiddenException,
    );
  });

  it("reads the class's @Can, and lets a handler's own override it", () => {
    expect(guard.canActivate(context(StatsRoutes, StatsRoutes.prototype.overview, 'STAFF'))).toBe(
      true,
    );
    expect(() =>
      guard.canActivate(context(StatsRoutes, StatsRoutes.prototype.manage, 'STAFF')),
    ).toThrow(ForbiddenException);
  });

  it('refuses when no admin was resolved in front of it', () => {
    expect(() => guard.canActivate(context(OrdersRoutes, OrdersRoutes.prototype.list))).toThrow(
      ForbiddenException,
    );
  });
});
