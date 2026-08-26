import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import type { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  async list(productSlug?: string, limit = 12) {
    const reviews = await this.prisma.review.findMany({
      where: { published: true, ...(productSlug ? { product: { slug: productSlug } } : {}) },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 50),
    });

    return reviews.map((r) => ({
      id: r.id,
      author: r.author,
      handle: r.handle,
      rating: r.rating,
      body: r.body,
      productSlug: r.product?.slug ?? null,
      createdAt: r.createdAt,
    }));
  }

  /** submitted reviews stay unpublished until someone looks at them */
  async create(dto: CreateReviewDto) {
    const product = dto.productSlug
      ? await this.catalog.requireProductRow(dto.productSlug)
      : null;

    const review = await this.prisma.review.create({
      data: {
        author: dto.author,
        handle: dto.handle,
        rating: dto.rating,
        body: dto.body,
        productId: product?.id,
        published: false,
      },
    });

    return { id: review.id, status: 'pending_moderation' as const };
  }
}
