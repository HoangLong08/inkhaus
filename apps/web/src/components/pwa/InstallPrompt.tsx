"use client";

import { Download, Share, X } from "lucide-react";
import { useInstallPrompt } from "@/lib/use-install-prompt";

/**
 * Shown from the studio once the user has actually put artwork on a garment,
 * never on page load. Chrome's own guidance is to ask at the point of
 * engagement, and "you've started a design, keep it on your home screen" is a
 * reason to install — a banner on the front page is just an interstitial.
 *
 * @param active gate from the caller; the hook's own checks still apply
 */
export default function InstallPrompt({ active }: { active: boolean }) {
  const { canInstall, needsManualInstall, dismissed, dismiss, install } = useInstallPrompt();

  if (!active || dismissed || (!canInstall && !needsManualInstall)) return null;

  return (
    <div className="mt-5 flex max-w-md items-start gap-3 rounded-xl border hairline bg-paper-2 px-4 py-3">
      <div className="flex-1 text-[12px] leading-relaxed text-ink/70">
        <p className="font-bold uppercase tracking-[0.12em] text-ink">Keep the studio handy</p>
        {needsManualInstall ? (
          <p className="mt-1.5">
            Install INKHAUS on this device: tap{" "}
            <Share size={12} className="inline -translate-y-px" aria-label="the Share button" /> Share,
            then <strong className="font-semibold text-ink">Add to Home Screen</strong>. Your designs
            stay saved on this device either way.
          </p>
        ) : (
          <p className="mt-1.5">
            Add it to your home screen and it opens like an app — and keeps working with no signal.
          </p>
        )}
        {canInstall && (
          <button
            type="button"
            onClick={() => void install()}
            className="mt-3 flex items-center gap-1.5 rounded-full bg-acid px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink"
          >
            <Download size={13} aria-hidden /> Install
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink/40 transition hover:bg-paper-3 hover:text-ink"
      >
        <X size={14} />
      </button>
    </div>
  );
}
