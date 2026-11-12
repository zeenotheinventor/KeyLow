import { describeLogPlateAction, describeLogPlateActionName } from "@keylow/core/copy";

import type { LogPlateButtonProps } from "./types";

import { Button } from "@/components/ui/Button";

/**
 * "Log food" or "Log foods", the one button that writes the plate, in the Add food dialog's footer. While it
 * writes it shows a spinner at full strength. When the plate cannot be logged, such as offline, it is
 * `aria-disabled` and dimmed by class, not `disabled`, so it keeps the focus and is still read out, and a press
 * does nothing. `Button` only dims `disabled`, so the dimming is written here.
 */
export function LogPlateButton({
  count,
  canLog,
  isLogging,
  onPress,
  buttonRef,
}: LogPlateButtonProps) {
  const isInert = !canLog && !isLogging;

  return (
    <Button
      ref={buttonRef}
      type="button"
      className={isInert ? "opacity-40" : undefined}
      aria-label={describeLogPlateActionName(count)}
      aria-disabled={isInert || undefined}
      loading={isLogging}
      loadingLabel="Logging"
      onClick={isInert ? undefined : onPress}
    >
      {describeLogPlateAction(count)}
    </Button>
  );
}
