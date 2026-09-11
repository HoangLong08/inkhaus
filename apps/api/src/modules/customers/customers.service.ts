import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Orders, saved designs and bulk quotes all arrive with just an email.
   * Upsert keeps one customer row per address without a signup flow.
   *
   * By default what the customer just typed wins over what is stored - checkout
   * and the lead form are the customer speaking for themselves. `update: false`
   * only creates a missing row and leaves an existing one exactly as it is: a
   * quote converted in the back office carries what the lead typed weeks ago,
   * and must not quietly undo a staff edit the audit log says was made since.
   */
  async findOrCreate(
    email: string,
    data: { name?: string; phone?: string; company?: string } = {},
    { update = true }: { update?: boolean } = {},
  ) {
    const normalised = email.trim().toLowerCase();
    return this.prisma.customer.upsert({
      where: { email: normalised },
      update: update
        ? {
            name: data.name ?? undefined,
            phone: data.phone ?? undefined,
            company: data.company ?? undefined,
          }
        : {},
      create: { email: normalised, ...data },
    });
  }
}
