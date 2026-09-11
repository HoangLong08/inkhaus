import { cn } from "cn";
import { Star } from "lucide-react";

const STARS = [1, 2, 3, 4, 5] as const;

/**
 * Five stars and the number beside them. The fill is decoration; the digits
 * are the signal, so a rating reads the same to someone who cannot tell amber
 * from grey, and a screen reader hears "4 out of 5 stars" rather than five
 * unlabelled icons.
 */
export default function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span aria-hidden className="inline-flex">
        {STARS.map((n) => (
          <Star
            key={n}
            className={cn("size-4", n <= rating ? "fill-amber text-amber" : "text-muted-foreground/40")}
          />
        ))}
      </span>
      <span className="text-muted-foreground text-xs tabular-nums">
        {rating}
        <span aria-hidden>/5</span>
        <span className="sr-only"> out of 5 stars</span>
      </span>
    </span>
  );
}
