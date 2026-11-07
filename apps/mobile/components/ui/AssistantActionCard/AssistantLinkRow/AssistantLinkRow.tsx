import { Icon } from "../../Icon";
import { PressableSurface } from "../../PressableSurface";
import { Text } from "../../Text";

import type { AssistantLinkRowProps } from "./types";

const placeClassNames = {
  inCard: "border-t border-border",
  standalone: "rounded-large border border-border bg-surface",
} as const;

/**
 * The line that opens what an assistant answer is about, such as the routine editor: the label in the accent
 * ink with a chevron, at the touch target's height. It is the last line of an action card, and it can stand on
 * its own under an answer that made no card.
 */
export function AssistantLinkRow({ label, onPress, isStandalone = false }: AssistantLinkRowProps) {
  return (
    <PressableSurface
      className={`min-h-touch-target flex-row items-center gap-2 px-3 ${placeClassNames[isStandalone ? "standalone" : "inCard"]}`}
      label={label}
      onPress={onPress}
    >
      <Text className="flex-1" tone="accent-ink" variant="body-strong">
        {label}
      </Text>
      <Icon name="ChevronRight" size="sm" tone="accent-ink" />
    </PressableSurface>
  );
}
