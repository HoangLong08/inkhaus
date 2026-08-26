import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  /** clip art library - `q` matches the name or any tag, same as the studio search box */
  async listClipart(q?: string) {
    const clips = await this.prisma.clipart.findMany({
      where: {
        active: true,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { tags: { has: q.toLowerCase() } },
              ],
            }
          : {}),
      },
      orderBy: { sortOrder: 'asc' },
    });

    return clips.map((c) => ({
      slug: c.slug,
      name: c.name,
      tags: c.tags.join(' '),
      svg: c.svg,
    }));
  }

  async listFonts() {
    const fonts = await this.prisma.font.findMany({ orderBy: { sortOrder: 'asc' } });
    return fonts.map((f) => ({ label: f.label, css: f.css }));
  }

  async listInks() {
    const inks = await this.prisma.inkColor.findMany({ orderBy: { sortOrder: 'asc' } });
    return inks.map((i) => ({ name: i.name, hex: i.hex }));
  }
}
