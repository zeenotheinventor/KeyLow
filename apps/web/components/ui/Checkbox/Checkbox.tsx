import { iconStroke } from "@keylow/tokens";
import { Check } from "lucide-react";

import type { CheckboxProps } from "./types";

import { cn } from "@/lib/utils";

// The portion default on the web food form is a one line label beside a 20px box. It is a design
// system addition drawn only on the approved boards, so these values are the boards'. A label that
// wraps (`multiline`) takes the design system checkbox: a 22px box with a 1.5px border at the top,
// 12px from regular weight text. The real checkbox is hidden and the box beside it follows its
// state, which keeps the native role, keyboard and form behaviour.
export function Checkbox({ label, multiline = false, className, ...inputProps }: CheckboxProps) {
  return (
    <label
      className={cn(
        "relative inline-flex min-h-touch-target cursor-pointer text-[14px] leading-5 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
        multiline ? "items-start gap-3 font-normal" : "items-center gap-2 font-semibold",
        className,
      )}
    >
      <input type="checkbox" className="peer sr-only" {...inputProps} />
      <span
        aria-hidden
        className={cn(
          "flex shrink-0 items-center justify-center rounded-small border border-border-strong bg-surface-raised text-accent-foreground transition-colors duration-quick motion-reduce:transition-none peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-focus-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-focus-ring-offset [&>svg]:invisible peer-checked:[&>svg]:visible",
          multiline ? "mt-px size-[22px] border-[1.5px]" : "size-5",
        )}
      >
        <Check
          aria-hidden
          className={multiline ? "size-4" : "size-[14px]"}
          strokeWidth={iconStroke}
        />
      </span>
      <span className={cn(multiline && "pt-0.5")}>{label}</span>
    </label>
  );
}
