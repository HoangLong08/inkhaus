"use client";

import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/lib/use-online-status";

export default function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-[100] flex items-center justify-center gap-2 bg-ink px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-paper"
    >
      <WifiOff size={14} aria-hidden />
      Offline — the studio still works
    </div>
  );
}
