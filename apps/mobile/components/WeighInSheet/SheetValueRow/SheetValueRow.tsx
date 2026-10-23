import { PressableSurface, Text } from "../../ui";

import type { SheetValueRowProps } from "./types";

/**
 * One row of the weigh-in sheet's Date and Time card as the board draws it: the label at the start and its
 * value in the secondary text colour at the end, 48 points high, with a hairline under every row but the
 * last. It is a button that opens the picker for that value, or does nothing when it is disabled.
 */
export function SheetValueRow({
  label,
  value,
  hasDivider,
  open,
  disabled = false,
  onPress,
}: SheetValueRowProps) {
  return (
    <PressableSurface
      // The classes are written out so Tailwind sees them.
      className={`min-h-[48px] flex-row items-center justify-between px-3 ${hasDivider ? "border-b border-border" : ""}`}
      disabled={disabled}
      expanded={open}
      onPress={onPress}
    >
      <Text>{label}</Text>
      <Text tone="secondary">{value}</Text>
    </PressableSurface>
  );
}
