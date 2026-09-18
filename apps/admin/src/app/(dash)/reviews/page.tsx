import { can, REVIEW_STATUSES } from "@inkhaus/shared/admin";
import { Inbox, SearchX } from "lucide-react";

import FilterLinks from "@/components/common/FilterLinks";
import ListEmpty from "@/components/common/ListEmpty";
import ListFooter from "@/components/common/ListFooter";
import ListHeader from "@/components/common/ListHeader";
import ListPage from "@/components/common/ListPage";
import { ordinalFrom } from "@/components/common/Ordinal";
import UrlSearchBox from "@/components/common/UrlSearchBox";
import ReviewsTable from "@/components/reviews/ReviewsTable";
import StatusFilterLinks from "@/components/StatusFilterLinks";
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
    <ListPage>
      <ListHeader
        title="Reviews"
        description="The moderation queue. Tick several to publish or reject them in one go."
      />

      <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2">
        <div className="w-full sm:w-64">
          <UrlSearchBox
            label="Search reviews"
            placeholder="Author, handle or review text"
            testId="reviews-search"
            clearTestId="reviews-search-clear"
          />
        </div>
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
        <ListEmpty
          icon={queueIsEmpty ? Inbox : SearchX}
          title={queueIsEmpty ? "Nothing waiting" : "No reviews match these filters"}
          description={
            queueIsEmpty
              ? "Every submitted review has been published or rejected."
              : "Try a different status or rating, or clear the search."
          }
          reason={queueIsEmpty ? "none" : "filtered"}
        />
      ) : (
        <ReviewsTable
          reviews={data}
          canModerate={can(user.role, "reviews.moderate")}
          canDelete={can(user.role, "reviews.delete")}
          // the same two numbers the footer below counts with. The page size is
          // the API's and is not in the URL, so it is only on `meta`.
          from={ordinalFrom(meta.page, meta.limit)}
        />
      )}

      {data.length > 0 ? (
        <ListFooter
          base="/reviews"
          page={meta.page}
          pages={meta.pages}
          limit={meta.limit}
          total={meta.total}
          shown={data.length}
          noun="reviews"
          params={params}
          // the page size is the API's 20 and is not in the URL - see the
          // schema, where it keeps a select-all inside REVIEW_BULK_MAX
          hideSize
        />
      ) : null}
    </ListPage>
  );
}
