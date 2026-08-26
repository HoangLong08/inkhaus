import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Orders, saved designs and bulk quotes all arrive with just an email.
   * Upsert keeps one customer row per address without a signup flow.
   */
  async findOrCreate(email: string, data: { name?: string; phone?: string; company?: string } = {}) {
    const normalised = email.trim().toLowerCase();
    return this.prisma.customer.upsert({
      where: { email: normalised },
      update: {
        name: data.name ?? undefined,
        phone: data.phone ?? undefined,
        company: data.company ?? undefined,
      },
      create: { email: normalised, ...data },
    });
  }
}
