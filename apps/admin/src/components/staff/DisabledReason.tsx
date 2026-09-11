import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * A disabled control with its reason one hover or one Tab away. A disabled
 * button gets neither pointer events nor focus, so the tooltip hangs off a
 * focusable wrapper instead, and the control inside lets the pointer through
 * to it. With no reason the control renders as it is, wrapper and all gone.
 */
export default function DisabledReason({
  reason,
  children,
}: {
  /** the sentence the server would refuse the change with, or null when it is allowed */
  reason: string | null;
  children: React.ReactNode;
}) {
  if (!reason) return children;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="focus-visible:ring-ring/50 inline-flex w-fit cursor-not-allowed rounded-md outline-none focus-visible:ring-[3px] [&>*]:pointer-events-none"
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}
