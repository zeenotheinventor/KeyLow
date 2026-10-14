import { View } from "react-native";

import { rowPressScale } from "../../../lib/motion";
import { useGroupedRowPosition } from "../GroupedList";
import { Icon } from "../Icon";
import { PressableSurface } from "../PressableSurface";
import { Text } from "../Text";
import { FoodRowSpinner } from "./FoodRowSpinner";
import { Macros } from "./Macros";

import type { FoodRowProps } from "./types";
import type { ReactNode } from "react";

// The title is 16 over 22 where body is 16 over 24, as the boards draw a food name. A matched part is
// the semibold weight and the rest the regular, so the match reads in bold.
const titleClassName = "leading-[22px]";

/** A food on the search and Your foods lists: its name with the matched words in bold, then its macros and energy. */
export function FoodRow({
  nameSegments,
  brand,
  energy,
  macros,
  basis,
  note,
  busyLabel,
  disabled = false,
  onPress,
}: FoodRowProps) {
  const { isFirst } = useGroupedRowPosition();
  const isBusy = busyLabel !== undefined;
  const name = nameSegments.map((segment) => segment.text).join("");
  const spokenEnergy = isBusy || energy === undefined ? undefined : `${energy} kcal`;

  // The line under the title says what is happening, or gives the macros, or says why there are none.
  // A screen reader gets the same in words, with the macros spelled out.
  let detailLine: ReactNode = null;
  let spokenDetail: string | undefined;
  if (isBusy) {
    detailLine = (
      <Text tone="secondary" variant="caption">
        {busyLabel}
      </Text>
    );
    spokenDetail = busyLabel;
  } else if (macros !== undefined) {
    detailLine = <Macros basis={basis} macros={macros} />;
    spokenDetail = macros.description;
  } else if (note !== undefined) {
    detailLine = (
      <Text tone="muted" variant="caption">
        {note}
      </Text>
    );
    spokenDetail = note;
  }
  const label = [name, brand, spokenDetail, spokenEnergy].filter(Boolean).join(", ");

  return (
    <PressableSurface
      busy={isBusy}
      className={`min-h-[60px] flex-row items-center gap-3 px-3 py-2 ${isFirst ? "" : "border-t border-border"} ${disabled && !isBusy ? "opacity-50" : ""}`}
      disabled={disabled}
      label={label}
      pressScale={rowPressScale}
      onPress={onPress}
    >
      <View className="h-control-sm w-control-sm shrink-0 items-center justify-center rounded-small bg-surface-raised">
        <Icon name="Utensils" tone="secondary" />
      </View>
      <View className="flex-1 gap-1">
        <Text className={titleClassName} numberOfLines={2}>
          {nameSegments.map((segment, index) => (
            <Text
              // The segments are cut from one name, so their order never changes.
              key={index}
              className={titleClassName}
              variant={segment.matched ? "body-strong" : "body"}
            >
              {segment.text}
            </Text>
          ))}
          {brand === undefined ? null : (
            <Text className={titleClassName} tone="muted">
              {` · ${brand}`}
            </Text>
          )}
        </Text>
        {detailLine}
      </View>
      {isBusy ? (
        <FoodRowSpinner />
      ) : (
        <>
          {energy === undefined ? null : (
            <View className="shrink-0 flex-row items-baseline gap-[3px]">
              <Text variant="numeral-small">{energy}</Text>
              <Text tone="muted" variant="caption">
                kcal
              </Text>
            </View>
          )}
          <Icon name="ChevronRight" size="sm" tone="muted" />
        </>
      )}
    </PressableSurface>
  );
}
