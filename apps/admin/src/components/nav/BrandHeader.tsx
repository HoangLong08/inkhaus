import Link from "next/link";
import { useTranslations } from "next-intl";

import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

/**
 * What sidebar-07 ships as a TeamSwitcher. There is one INKHAUS and there are no
 * teams, so a switcher would be a control that promises a choice nobody has.
 *
 * The mark is a square chip rather than the wordmark alone because it has to
 * survive `collapsible="icon"`: when the rail narrows, the chip is all that is
 * left. It is also the only place `acid` appears at rest in this whole app -
 * everywhere else the accent is reserved for state, not decoration.
 */
export function BrandHeader() {
  // "INKHAUS" and "IH" are the brand and are never translated; only the line
  // under them says what this particular app is.
  const t = useTranslations("Chrome");

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" asChild>
          <Link href="/">
            <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-md">
              <span className="text-xs font-black tracking-tighter">IH</span>
            </div>
            <div className="grid flex-1 text-left leading-tight">
              <span className="truncate text-sm font-black uppercase tracking-tight">
                INKHAUS
              </span>
              <span className="text-muted-foreground truncate text-xs">{t("brandSub")}</span>
            </div>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
