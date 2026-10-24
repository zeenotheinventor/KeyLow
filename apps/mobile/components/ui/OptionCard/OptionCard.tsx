import { View } from "react-native";

import { Badge } from "../Badge";
import { Icon } from "../Icon";
import { PressableSurface } from "../PressableSurface";
import { Text } from "../Text";

import type { OptionCardProps } from "./types";

// The classes are written out so Tailwind sees them. The chosen card is the accent border drawn at 2
// points: the card's own hairline plus the line inside it (see `ChosenLine`), so the card keeps its size.
const cardLooks = {
  chosen: {
    cardClassName: "border-accent bg-accent-muted",
    radioClassName: "border-accent bg-accent",
  },
  other: {
    cardClassName: "border-border bg-surface",
    radioClassName: "border-border-strong bg-transparent",
  },
};

// Spoken, a name stops at a comma, so a closing full stop on a sentence adds nothing.
function withoutFinalStop(words: string): string {
  return words.endsWith(".") ? words.slice(0, -1) : words;
}

/**
 * The name a screen reader gives the card: the title, then the badge, the description, the reason it is
 * disabled and the value, each as it was given. The card reads as one radio, so its parts are one name.
 */
function accessibleName({
  title,
  badge,
  description,
  disabledReason,
  value,
  valueCaption,
  valueLabel,
}: OptionCardProps): string {
  const spokenValue = valueLabel ?? [value, valueCaption].filter(Boolean).join(" ");
  return [title, badge?.children, description, disabledReason, spokenValue]
    .filter((words): words is string => words !== undefined && words !== "")
    .map(withoutFinalStop)
    .join(", ");
}

/**
 * A card that is one answer to a question, drawn with a radio at its start. At least 56 points high, with
 * a title, and optionally a description, a badge, a figure at the end with a caption, and a reason it
 * cannot be chosen. It is a radio for a screen reader, named by its parts, and belongs in an
 * `OptionCardGroup`. It shares the press scale and overlay of every pressable and plays the selection
 * haptic when it is chosen.
 */
export function OptionCard(props: OptionCardProps) {
  const { title, description, badge, value, valueCaption, checked, disabledReason, onPress } =
    props;
  const isDisabled = disabledReason !== undefined;
  const look = cardLooks[checked ? "chosen" : "other"];
  const dimClassName = isDisabled ? "opacity-40" : "";

  return (
    <PressableSurface
      checked={checked}
      className={`min-h-[56px] flex-row items-center gap-3 rounded-medium border px-4 py-3 ${look.cardClassName}`}
      disabled={isDisabled}
      // Pressing the chosen card changes nothing, so it plays no haptic and says nothing.
      haptic={checked ? undefined : "select"}
      label={accessibleName(props)}
      role="radio"
      onPress={checked ? undefined : onPress}
    >
      {checked ? (
        // The board draws the chosen border as a 1 point border with a 1 point line inside it. The line's
        // radius is 11: the 12 point rounded-medium less the 1 point border, so its corners follow the card's.
        <View aria-hidden className="absolute inset-0 rounded-[11px] border border-accent" />
      ) : null}
      <View
        aria-hidden
        className={`h-5 w-5 shrink-0 items-center justify-center rounded-pill border-2 ${look.radioClassName} ${dimClassName}`}
      >
        {checked ? <View className="h-2 w-2 rounded-pill bg-accent-foreground" /> : null}
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <View className={`flex-row items-center gap-2 ${dimClassName}`}>
          <Text className="shrink" variant="body-strong">
            {title}
          </Text>
          {badge === undefined ? null : <Badge {...badge} />}
        </View>
        {description === undefined ? null : (
          <Text className={dimClassName} tone="secondary" variant="caption">
            {description}
          </Text>
        )}
        {disabledReason === undefined ? null : (
          <View className="flex-row items-center gap-1.5">
            <Icon name="Info" size={14} tone="secondary" />
            <Text className="flex-1" tone="secondary" variant="caption">
              {disabledReason}
            </Text>
          </View>
        )}
      </View>
      {value === undefined ? null : (
        <View className="shrink-0 items-end">
          <Text variant="body-strong">{value}</Text>
          {valueCaption === undefined ? null : (
            <Text tone="muted" variant="caption">
              {valueCaption}
            </Text>
          )}
        </View>
      )}
    </PressableSurface>
  );
}
