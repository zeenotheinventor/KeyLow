import { View } from "react-native";

import { OptionCard } from "./OptionCard";

import type { OptionCardGroupProps } from "./types";

/**
 * The options of one question, drawn as cards with 8 points between them. By default a radio group named
 * by the question, with one choice: pressing a card hands its id to `onChange`, and pressing the chosen
 * one says nothing. With `selection="multiple"` a plain group of checkboxes: `value` is the list of chosen
 * ids, and a press hands `onChange` the list with that id added at the end, or taken out when it was
 * chosen. The group is not itself an accessibility element, so a screen reader reaches each card.
 */
export function OptionCardGroup<Id extends string>(props: OptionCardGroupProps<Id>) {
  const { label, options } = props;

  return (
    <View
      aria-label={label}
      className="gap-2"
      role={props.selection === "multiple" ? "group" : "radiogroup"}
    >
      {options.map(({ id, ...card }) => {
        if (props.selection === "multiple") {
          const isChecked = props.value.includes(id);
          return (
            <OptionCard
              key={id}
              {...card}
              checked={isChecked}
              selection="multiple"
              onPress={() => {
                props.onChange(
                  isChecked ? props.value.filter((chosen) => chosen !== id) : [...props.value, id],
                );
              }}
            />
          );
        }
        return (
          <OptionCard
            key={id}
            {...card}
            checked={id === props.value}
            onPress={() => {
              props.onChange(id);
            }}
          />
        );
      })}
    </View>
  );
}
