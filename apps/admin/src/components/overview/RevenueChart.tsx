"use client";

import { cn } from "cn";
import { ChartArea } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { count, usd } from "@/lib/format";
import type { StatsSeriesPoint } from "@/lib/schemas/api";

import { compactUsd, longDay, shortDay } from "./labels";

const chartConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
  orders: { label: "Paid orders", color: "var(--chart-2)" },
} satisfies ChartConfig;

type Measure = keyof typeof chartConfig;

/** dollars get compact ticks and cents in the tooltip; orders are whole numbers */
const MEASURES: Record<
  Measure,
  { height: string; tick: (value: number) => string; value: (value: number) => string }
> = {
  revenue: { height: "h-48", tick: compactUsd, value: usd },
  orders: { height: "h-28", tick: count, value: count },
};

/**
 * Revenue and paid orders per day, as two small charts on one shared day axis
 * rather than one chart with two y-axes. Dollars and order counts have no
 * common scale, and a second axis invents a relationship wherever the two
 * lines happen to cross. `syncId` keeps a single crosshair across both.
 *
 * Hidden from assistive technology on purpose: SeriesTable beside it is the
 * same series as a table a screen reader can actually read, and the chart's
 * keyboard layer is off so nothing focusable sits inside the hidden subtree.
 *
 * A range with no paid orders at all draws nothing rather than two flat lines
 * along the floor.
 */
export default function RevenueChart({ series }: { series: StatsSeriesPoint[] }) {
  if (series.every((point) => point.orders === 0)) {
    return (
      <div data-testid="revenue-chart" data-empty="true">
        <Empty className="py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ChartArea />
            </EmptyMedia>
            <EmptyTitle>No paid orders in this range</EmptyTitle>
            <EmptyDescription>Every day came to $0. A longer range may show more.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div data-testid="revenue-chart" data-empty="false" aria-hidden="true" className="space-y-3">
      <MeasureChart series={series} measure="revenue" />
      <MeasureChart series={series} measure="orders" showDays />
    </div>
  );
}

function MeasureChart({
  series,
  measure,
  showDays = false,
}: {
  series: StatsSeriesPoint[];
  measure: Measure;
  /** the day axis is drawn once, under the last chart */
  showDays?: boolean;
}) {
  const { height, tick, value } = MEASURES[measure];
  const color = `var(--color-${measure})`;
  const label = chartConfig[measure].label;

  return (
    <div>
      <p className="text-muted-foreground mb-1 text-xs font-medium">{label}</p>
      <ChartContainer config={chartConfig} className={cn("aspect-auto w-full", height)}>
        <AreaChart
          data={series}
          syncId="overview-series"
          accessibilityLayer={false}
          margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            hide={!showDays}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={32}
            tickFormatter={shortDay}
          />
          {/* the same width on both charts, so their plots line up day for day */}
          <YAxis
            width={56}
            tickLine={false}
            axisLine={false}
            tickMargin={4}
            allowDecimals={measure === "revenue"}
            tickFormatter={tick}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(day) => longDay(String(day))}
                formatter={(amount) => (
                  <>
                    <span className="text-muted-foreground">{label}</span>
                    <span className="text-foreground ml-auto font-mono font-medium tabular-nums">
                      {value(Number(amount))}
                    </span>
                  </>
                )}
              />
            }
          />
          <Area
            dataKey={measure}
            type="monotone"
            stroke={color}
            strokeWidth={2}
            fill={color}
            fillOpacity={0.1}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
