"use client";

import { Input } from "@/components/ui/input";

type Props = Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange"> & {
  value: number;
  onChange: (value: number) => void;
};

/**
 * A shadcn Input that holds a number, not a string. An empty box is NaN, which
 * the field's zod schema reports as "Enter a …" - so a cleared price is a
 * message under the field, never a silent 0.
 */
export default function NumberInput({ value, onChange, ...props }: Props) {
  return (
    <Input
      type="number"
      {...props}
      value={Number.isFinite(value) ? value : ""}
      onChange={(event) => onChange(event.target.valueAsNumber)}
    />
  );
}
