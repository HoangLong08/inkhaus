"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/** the one thing the packing slip needs JavaScript for; hidden on the printout itself */
export default function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()} data-testid="packing-slip-print">
      <Printer />
      Print
    </Button>
  );
}
