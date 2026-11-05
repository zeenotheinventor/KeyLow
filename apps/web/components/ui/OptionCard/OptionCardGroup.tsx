import { useRef } from "react";

import { OptionCard } from "./OptionCard";

import type { OptionCardGroupOption, OptionCardGroupProps } from "./types";

/** The option an arrow key moves to from `index`, wrapping at the ends and passing over any not offered. */
function nextOfferedIndex<Id extends string>(
  options: readonly OptionCardGroupOption<Id>[],
  index: number,
  step: 1 | -1,
): number | undefined {
  for (let offset = 1; offset < options.length; offset += 1) {
    const candidate = (index + step * offset + options.length * offset) % options.length;
    if (options[candidate]?.disabledReason === undefined) {
      return candidate;
    }
  }
  return undefined;
}

const stepOfKey: Readonly<Record<string, 1 | -1>> = {
  ArrowDown: 1,
  ArrowRight: 1,
  ArrowUp: -1,
  ArrowLeft: -1,
};

/**
 * The options of one question, drawn as cards 8 px apart. By default a radio group named by the question,
 * with one choice: pressing a card hands its id to `onChange`, and pressing the chosen one says nothing.
 * Only one radio is in the tab order (the chosen one, or the first offered), and the arrow keys move the
 * choice and the focus together, wrapping at the ends and passing over an option that is not offered, as
 * the WAI-ARIA radio group pattern asks. With `selection="multiple"` a group of checkboxes, each its own
 * tab stop: `value` is the list of chosen ids, and a press hands `onChange` the list with that id added at
 * the end, or taken out when it was chosen.
 */
export function OptionCardGroup<Id extends string>(props: OptionCardGroupProps<Id>) {
  const { label, options } = props;
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  const chosenIndex =
    props.selection === "multiple" ? -1 : options.findIndex((option) => option.id === props.value);
  const firstOfferedIndex = options.findIndex((option) => option.disabledReason === undefined);
  const tabbableIndex = chosenIndex === -1 ? firstOfferedIndex : chosenIndex;

  return (
    <div
      role={props.selection === "multiple" ? "group" : "radiogroup"}
      aria-label={label}
      className="flex flex-col gap-2"
    >
      {options.map(({ id, ...card }, index) => {
        const setRef = (element: HTMLButtonElement | null) => {
          cards.current[index] = element;
        };

        if (props.selection === "multiple") {
          const isChecked = props.value.includes(id);
          return (
            <OptionCard
              key={id}
              ref={setRef}
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
            ref={setRef}
            {...card}
            checked={id === props.value}
            tabIndex={index === tabbableIndex ? 0 : -1}
            onPress={() => {
              props.onChange(id);
            }}
            onKeyDown={(event) => {
              const step = stepOfKey[event.key];
              if (step === undefined || event.altKey || event.metaKey || event.ctrlKey) return;
              event.preventDefault();
              const nextIndex = nextOfferedIndex(options, index, step);
              const next = nextIndex === undefined ? undefined : options[nextIndex];
              if (next !== undefined && nextIndex !== undefined) {
                props.onChange(next.id);
                cards.current[nextIndex]?.focus();
              }
            }}
          />
        );
      })}
    </div>
  );
}
