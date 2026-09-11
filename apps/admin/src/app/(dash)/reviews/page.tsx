import { can, REVIEW_STATUSES } from "@inkhaus/shared/admin";
import { Inbox, SearchX } from "lucide-react";

import FilterLinks from "@/components/common/FilterLinks";
import ListHeader from "@/components/common/ListHeader";
import UrlSearchBox from "@/components/common/UrlSearchBox";
import Pager from "@/components/Pager";
import ReviewsTable from "@/components/reviews/ReviewsTable";
import StatusFilterLinks from "@/components/StatusFilterLinks";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { adminApi } from "@/lib/api";
import { requireAdmin } from "@/lib/dal";
import { REVIEW_RATINGS, reviewsQuerySchema } from "@/lib/schemas/params";

export const metadata = { title: "Reviews — INKHAUS Back Office" };

const starLabel = (value: string) => `${value} ${value === "1" ? "star" : "stars"}`;

/**
 * The moderation queue. Server rendered like every other list: the rows are a
 * pure projection of the URL, and so are the filters.
 *
 * The table is the one client leaf, because a checkbox selection and a badge
 * that flips before the server answers are browser state. It renders the rows
 * this page hands it and never fetches a list of its own; after a write it asks
 * for a router refresh, which runs this page again.
 */
export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // requireAdmin is React-cached - the layout has already paid for it
  const [user, raw] = await Promise.all([requireAdmin(), searchParams]);
  const params = reviewsQuerySchema.parse(raw);
  const { data, meta } = await adminApi.reviews.list(params);

  const queueIsEmpty = params.status === "PENDING" && !params.q && !params.rating;

  return (
    <div className="space-y-6">
      <ListHeader
        title="Reviews"
        meta={`${meta.total} total · page ${meta.page} of ${meta.pages}`}
        metaTestId="reviews-meta"
      />

      <UrlSearchBox
        label="Search reviews"
        placeholder="Author, handle or review text"
        testId="reviews-search"
        clearTestId="reviews-search-clear"
      />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <StatusFilterLinks
          base="/reviews"
          statuses={REVIEW_STATUSES}
          active={params.status}
          params={params}
        />
        <FilterLinks
          base="/reviews"
          param="rating"
          values={REVIEW_RATINGS}
          active={params.rating?.toString()}
          params={params}
          ariaLabel="Filter by rating"
          allLabel="Any rating"
          label={starLabel}
        />
      </div>

      {data.length === 0 ? (
        <Card>
          <Empty className="py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">{queueIsEmpty ? <Inbox /> : <SearchX />}</EmptyMedia>
              <EmptyTitle>
                {queueIsEmpty ? "Nothing waiting" : "No reviews match these filters"}
              </EmptyTitle>
              <EmptyDescription>
                {queueIsEmpty
                  ? "Every submitted review has been published or rejected."
                  : "Try a different status or rating, or clear the search."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </Card>
      ) : (
        <ReviewsTable
          reviews={data}
          canModerate={can(user.role, "reviews.moderate")}
          canDelete={can(user.role, "reviews.delete")}
        />
      )}

      <Pager base="/reviews" page={meta.page} pages={meta.pages} params={params} />
    </div>
  );
}
