import dynamic from "next/dynamic";
import type { Metadata } from "next";

const Studio = dynamic(() => import("@/components/studio/Studio"), {
  loading: () => (
    <div className="grid min-h-[100svh] place-items-center pt-[var(--nav-h)] text-[11px] uppercase tracking-[0.2em] text-ink/40">
      Loading the studio…
    </div>
  ),
});

export const metadata: Metadata = {
  title: "Design Studio — INKHAUS",
  description: "Upload artwork, add text, pick clip art and see it printed live.",
};

export default function DesignPage() {
  return <Studio />;
}
