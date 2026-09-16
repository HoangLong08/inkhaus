"use client";

import { Monitor, Moon, Sun, SunMoon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const OPTIONS = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
] as const;

/**
 * The trigger icon is fixed rather than reflecting the active theme, which is
 * what lets this component avoid the usual `mounted` dance: the server cannot
 * know the resolved theme, so an icon that depends on it either mismatches on
 * hydration or needs a state-setting effect to paper over the gap.
 *
 * The current choice is shown where it belongs anyway - as the checked item in
 * the menu, which only mounts on the client when the menu is opened.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations("Chrome.themeToggle");
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={className}
          data-testid="theme-toggle"
          aria-label={t("aria")}
        >
          <SunMoon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          {OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              data-testid={`theme-${option.value}`}
            >
              <option.icon className="size-4" />
              {t(option.value)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
