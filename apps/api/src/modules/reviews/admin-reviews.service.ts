import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type ReviewStatus } from '@prisma/client';

import { AuditService } from '../../common/audit/audit.service';
import { paginate, type Paginated } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  buildReviewWhere,
  lockOrder,
  moderationFields,
  moderationSummary,
  planModeration,
} from './admin-reviews.rules';
import type { AdminListReviewsDto } from './dto/admin-list-reviews.dto';

/** one row of GET /admin/reviews, and what PATCH answers with - the admin parses exactly this */
export type AdminReviewItem = {
  id: string;
  author: string;
  handle: string | null;
  rating: number;
  body: string;
  product: { slug: string; name: string } | null;
  status: ReviewStatus;
  createdAt: string;
  moderatedAt: string | null;
  moderatedBy: { id: string; name: string | null; email: string } | null;
};

export type ModerationActor = { id: string };

const reviewSelect = {
  id: true,
  author: true,
  handle: true,
  rating: true,
  body: true,
  status: true,
  createdAt: true,
  moderatedAt: true,
  product: { select: { slug: true, name: true } },
  moderatedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.ReviewSelect;

type ReviewRow = Prisma.ReviewGetPayload<{ select: typeof reviewSelect }>;

export const REVIEW_CHANGED_MESSAGE =
  'This review changed while you were looking at it. Reload and try again.';
export const REVIEWS_CHANGED_MESSAGE =
  'Some of these reviews changed while you were looking at them. Reload and try again.';

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * Review moderation - publish, reject, send back, delete.
 *
 * Every write is one interactive transaction that reads, decides, writes with
 * a condition on what it read, and appends its audit entry. A change that
 * commits without its entry, or an entry for a change that rolled back, is
 * worse than no trail at all - which is why the entry goes through the same
 * `tx`.
 */
@Injectable()
export class AdminReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** newest first, every status unless one is asked for */
  async list(query: AdminListReviewsDto): Promise<Paginated<AdminReviewItem>> {
    const where = buildReviewWhere(query);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        select: reviewSelect,
        // id breaks ties, so a page boundary never shows a row twice or not at all
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.review.count({ where }),
    ]);

    return paginate(
      rows.map((row) => this.toDto(row)),
      total,
      query,
    );
  }

  /**
   * One review to one status. Asking for the status it already has is not an
   * error, and not a decision either: nothing is written, so a double click on
   * Publish cannot rewrite who published it.
   *
   * The update only matches while the review is still in the status that was
   * read, so two moderators disagreeing about the same review cannot both win:
   * the second gets a 409 and sees the first one's decision on reload.
   */
  async moderate(
    id: string,
    status: ReviewStatus,
    actor: ModerationActor,
  ): Promise<AdminReviewItem> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.review.findUnique({
        where: { id },
        select: { status: true, author: true },
      });
      if (!current) throw new NotFoundException(`No review "${id}"`);

      if (current.status !== status) {
        const { count } = await tx.review.updateMany({
          where: { id, status: current.status },
          data: moderationFields(status, actor.id, new Date()),
        });
        if (count === 0) throw new ConflictException(REVIEW_CHANGED_MESSAGE);

        await this.audit.record(tx, {
          actorId: actor.id,
          action: 'review.moderate',
          entity: 'review',
          entityId: id,
          summary: moderationSummary(status, `the review by ${current.author}`),
          before: { status: current.status },
          after: { status },
        });
      }

      return this.toDto(await tx.review.findUniqueOrThrow({ where: { id }, select: reviewSelect }));
    });
  }

  /**
   * Up to REVIEW_BULK_MAX reviews to one status, all or nothing.
   *
   * An id that no longer exists fails the whole batch rather than being
   * skipped: the operator chose that set, and quietly acting on part of it
   * would leave them believing something happened that did not. Reviews
   * already in the target status are left untouched and not counted.
   *
   * One conditional update per status the selection was read in (at most two,
   * since the third is the target), each of which must match every row it was
   * aimed at - otherwise somebody moved one in between, and the lot rolls back
   * with a 409. Then one audit entry for the batch, listing each review with
   * the status it left.
   */
  async bulkModerate(
    ids: string[],
    status: ReviewStatus,
    actor: ModerationActor,
  ): Promise<{ updated: number }> {
    return this.prisma.$transaction(async (tx) => {
      // Read AND lock the selection up front, in one fixed order. The updates
      // below would otherwise lock rows in whatever order Postgres scans them,
      // and two overlapping bulk actions could each end up holding a row the
      // other needs. With every row already held, the conditional updates can
      // only miss a row that was deleted, and the counts still say so.
      const rows = await tx.$queryRaw<{ id: string; status: ReviewStatus }[]>`
        SELECT "id", "status"::text AS "status"
        FROM "reviews"
        WHERE "id" IN (${Prisma.join(lockOrder(ids))})
        ORDER BY "id"
        FOR UPDATE`;

      const plan = planModeration(ids, rows, status);
      if (plan.missing.length > 0) {
        const n = plan.missing.length;
        throw new NotFoundException(
          `${n} of the selected reviews ${plural(n, 'no longer exists', 'no longer exist')}. Reload and try again.`,
        );
      }
      if (plan.moves.length === 0) return { updated: 0 };

      const data = moderationFields(status, actor.id, new Date());
      let updated = 0;
      for (const move of plan.moves) {
        const { count } = await tx.review.updateMany({
          where: { id: { in: move.ids }, status: move.from },
          data,
        });
        if (count !== move.ids.length) throw new ConflictException(REVIEWS_CHANGED_MESSAGE);
        updated += count;
      }

      await this.audit.record(tx, {
        actorId: actor.id,
        action: 'review.bulk_moderate',
        entity: 'review',
        // one entry for the batch, as the brief asks; the reviews themselves
        // are in before/after, which is where a person reading the log looks
        entityId: 'bulk',
        summary: moderationSummary(status, `${updated} ${plural(updated, 'review', 'reviews')}`),
        before: plan.moves.flatMap((move) => move.ids.map((id) => ({ id, status: move.from }))),
        after: { status, ids: plan.moves.flatMap((move) => move.ids) },
      });

      return { updated };
    });
  }

  /**
   * Gone for good - the storefront has no soft-delete to fall back on, so the
   * audit entry keeps the whole review as it was. Owner-only, which the
   * controller's `@Can('reviews.delete')` enforces.
   */
  async remove(id: string, actor: ModerationActor): Promise<{ deleted: true; id: string }> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.review.findUnique({ where: { id }, select: reviewSelect });
      if (!row) throw new NotFoundException(`No review "${id}"`);

      // deleteMany, so a delete that lost a race to another one is a clean 404
      // rather than a P2025 thrown from inside the transaction
      const { count } = await tx.review.deleteMany({ where: { id } });
      if (count === 0) throw new NotFoundException(`No review "${id}"`);

      await this.audit.record(tx, {
        actorId: actor.id,
        action: 'review.delete',
        entity: 'review',
        entityId: id,
        summary: `Deleted the review by ${row.author}`,
        before: this.toDto(row),
      });

      return { deleted: true as const, id };
    });
  }

  private toDto(r: ReviewRow): AdminReviewItem {
    return {
      id: r.id,
      author: r.author,
      handle: r.handle,
      rating: r.rating,
      body: r.body,
      product: r.product ? { slug: r.product.slug, name: r.product.name } : null,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      moderatedAt: r.moderatedAt?.toISOString() ?? null,
      moderatedBy: r.moderatedBy
        ? { id: r.moderatedBy.id, name: r.moderatedBy.name, email: r.moderatedBy.email }
        : null,
    };
  }
}
