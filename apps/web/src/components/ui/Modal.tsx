"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * The dialog shell behind the quick view and the image lightbox.
 *
 * Portals to <body> so a card's `overflow-hidden` and stacking context cannot
 * clip it, traps focus while it is open, restores focus on close, and locks the
 * background scroll — the things a dialog has to get right and that are easy to
 * forget when each one is written separately.
 */
export default function Modal({
  open,
  onClose,
  label,
  children,
  className = "",
  testid,
  bare = false,
}: {
  open: boolean;
  onClose: () => void;
  /** accessible name — there is no visible title in the lightbox */
  label: string;
  children: React.ReactNode;
  className?: string;
  testid?: string;
  /** no panel chrome, for the lightbox where the image is the whole surface */
  bare?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const focusables = () =>
      Array.from(
        panel.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    // let the panel mount before reaching for something inside it
    const t = setTimeout(() => focusables()[0]?.focus(), 60);

    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
      document.body.style.overflow = overflow;
      restoreTo.current?.focus?.();
    };
  }, [open, onClose]);

  // createPortal needs a document; this component is only ever rendered on the
  // client, but the first pass of a client component still runs on the server
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] grid place-items-center p-4 sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <div
            className="absolute inset-0 bg-ink/70 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            data-testid={testid}
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.32, ease: EASE }}
            className={`relative max-h-full w-full overflow-auto ${
              bare ? "" : "rounded-3xl border hairline bg-paper shadow-2xl"
            } ${className}`}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={`absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full transition ${
                bare
                  ? "bg-paper/90 text-ink hover:bg-paper"
                  : "border hairline bg-paper/90 text-ink/60 backdrop-blur hover:text-ink"
              }`}
            >
              <X size={18} />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
