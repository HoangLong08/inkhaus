import { Shirt } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/** its own h1, like every page - EmptyTitle is a div, not a heading */
export default function ProductNotFound() {
  const t = useTranslations("Product");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("notFound.title")}</h1>
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Shirt />
          </EmptyMedia>
          <EmptyTitle>{t("notFound.emptyTitle")}</EmptyTitle>
          <EmptyDescription>
            {t("notFound.description")}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild variant="outline">
            <Link href="/catalog" data-testid="product-not-found-back">
              {t("notFound.action")}
            </Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
