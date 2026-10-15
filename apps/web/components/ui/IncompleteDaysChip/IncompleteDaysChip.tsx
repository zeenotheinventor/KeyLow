import { describeIncompleteDays } from "@keylow/core";
import { iconStroke } from "@keylow/tokens";
import { CheckCircle2, CircleDashed } from "lucide-react";

import type { IncompleteDaysChipProps } from "./types";

import { cn } from "@/lib/utils";

// A status tone is the tone's muted fill with the tone's colour as the text. In light mode that
// colour is too weak for small text, so the words fall back to the primary text colour and the
// icon keeps the colour. The icon is not text, so it takes its colour as a stroke.
const tones = {
  warning: "bg-warning-muted text-warning light-theme:text-text-primary",
  success: "bg-success-muted text-success light-theme:text-text-primary",
} as const;

const iconTones = { warning: "stroke-warning", success: "stroke-success" } as const;

const frame =
  "inline-flex min-h-7 items-center gap-[6px] whitespace-nowrap rounded-pill px-3 text-caption tabular-nums";

// A pressable chip is 28 px tall, so a hit area reaching 8 px above and below brings the target to
// the 44 px the touch target token names.
const pressable =
  "relative cursor-pointer outline-none after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-focus-ring-offset";

/** Reports the week: warning-toned while days are incomplete, success-toned when none are. The words carry the meaning. */
export function IncompleteDaysChip({
  count = 0,
  onPress,
  className,
  ...rest
}: IncompleteDaysChipProps) {
  const tone = count > 0 ? "warning" : "success";
  const Icon = count > 0 ? CircleDashed : CheckCircle2;
  const classes = cn(frame, tones[tone], onPress !== undefined && pressable, className);
  const content = (
    <>
      <Icon aria-hidden className={cn("size-4", iconTones[tone])} strokeWidth={iconStroke} />
      {describeIncompleteDays(count)}
    </>
  );

  if (onPress === undefined) {
    return (
      <span className={classes} {...rest}>
        {content}
      </span>
    );
  }

  return (
    <button type="button" className={classes} onClick={onPress} {...rest}>
      {content}
    </button>
  );
}
