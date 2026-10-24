import { View } from "react-native";

import { OptionCard } from "./OptionCard";

import type { OptionCardGroupProps } from "./types";

/**
 * The options of one question, drawn as cards with 8 points between them. A radio group named by the
 * question, with one choice: pressing a card hands its id to `onChange`, and pressing the chosen one
 * says nothing. The group is not itself an accessibility element, so a screen reader reaches each card.
 */
export function OptionCardGroup<Id extends string>({
  label,
  options,
  value,
  onChange,
}: OptionCardGroupProps<Id>) {
  return (
    <View aria-label={label} className="gap-2" role="radiogroup">
      {options.map(({ id, ...card }) => (
        <OptionCard
          key={id}
          {...card}
          checked={id === value}
          onPress={() => {
            onChange(id);
          }}
        />
      ))}
    </View>
  );
}
