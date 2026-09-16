"use client";

import { useMutation } from "@tanstack/react-query";
import { Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOCALES, type Locale } from "@/i18n/config";
import { clientApi, ClientApiError } from "@/lib/client-api";

/**
 * Sits beside ThemeToggle in the (dash) header and is built the same way, with
 * one difference worth knowing: ThemeToggle keeps a fixed trigger icon to avoid
 * the `mounted` dance, because the server cannot know the resolved theme. The
 * locale has no such gap - it comes from the server through the provider - so
 * `useLocale()` is safe to read during render. The icon stays fixed anyway, for
 * symmetry and because the checked radio item is where the state belongs.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const t = useTranslations("Chrome.languageToggle");
  const locale = useLocale();
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();

  /**
   * Deliberately none of onMutate / setQueryData / invalidateQueries, which
   * AGENTS.md s4 asks of every other write. There is no cached entity here: the
   * server render IS the state, so the only thing to do on success is ask for it
   * again.
   *
   * router.refresh() runs AFTER the PUT resolves, not alongside it, or the
   * refresh races the Set-Cookie and re-renders in the old language. It is also
   * not a location.reload(): a hard load would throw away scroll position, any
   * open dialog and the whole query cache for what is a preference change.
   */
  const mutation = useMutation({
    mutationFn: (next: Locale) => clientApi.locale.set(next),
    onSuccess: () => startTransition(() => router.refresh()),
    onError: (error) => {
      // stay silent on a 401: client-api/core.ts has already sent them to /login
      if (error instanceof ClientApiError && error.status === 401) return;
      toast.error(t("error"));
    },
  });

  const busy = mutation.isPending || refreshing;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={className}
          data-testid="language-toggle"
          aria-label={t("aria")}
          disabled={busy}
        >
          <Languages className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={locale}
          onValueChange={(next) => mutation.mutate(next as Locale)}
        >
          {LOCALES.map((value) => (
            <DropdownMenuRadioItem
              key={value}
              value={value}
              data-testid={`language-${value}`}
              disabled={busy}
            >
              {t(value)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
