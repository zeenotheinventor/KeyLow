import { iconStroke } from "@keylow/tokens";
import { Check } from "lucide-react";

import type { CheckboxProps } from "./types";

import { cn } from "@/lib/utils";

// The portion default on the web food form. It is a design system addition drawn only on the
// approved boards, so these values are the boards'. The real checkbox is hidden and the box beside
// it follows its state, which keeps the native role, keyboard and form behaviour.
export function Checkbox({ label, className, ...inputProps }: CheckboxProps) {
  return (
    <label
      className={cn(
        "relative inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-[14px] font-semibold leading-5 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
        className,
      )}
    >
      <input type="checkbox" className="peer sr-only" {...inputProps} />
      <span
        aria-hidden
        className="flex size-5 shrink-0 items-center justify-center rounded-small border border-border-strong bg-surface-raised text-accent-foreground transition-colors duration-quick motion-reduce:transition-none peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-focus-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-focus-ring-offset [&>svg]:invisible peer-checked:[&>svg]:visible"
      >
        <Check aria-hidden className="size-[14px]" strokeWidth={iconStroke} />
      </span>
      {label}
    </label>
  );
}
