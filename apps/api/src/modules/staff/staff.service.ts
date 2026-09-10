import { Injectable } from '@nestjs/common';
import type { AdminRole } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

/** one row of GET /admin/staff/directory - the admin app parses exactly this shape */
export type StaffDirectoryEntry = {
  id: string;
  name: string | null;
  email: string;
  role: AdminRole;
};

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

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
}
