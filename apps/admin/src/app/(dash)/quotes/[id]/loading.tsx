import { OrderDetailSkeleton } from "@/components/skeletons";

// the quote page shares the order page's frame - a heading, then a wide
// column and a narrow one - so the order skeleton lines up with it
export default function Loading() {
  return <OrderDetailSkeleton />;
}
