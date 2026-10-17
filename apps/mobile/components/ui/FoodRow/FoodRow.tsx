import { FOOD_ROW, describeAddFood, describeFoodRowStats } from "@keylow/core/copy";
import { View } from "react-native";

import { rowPressScale } from "../../../lib/motion";
import { useGroupedRowPosition } from "../GroupedList";
import { Icon } from "../Icon";
import { IconButton } from "../IconButton";
import { PressableSurface } from "../PressableSurface";
import { Text } from "../Text";
import { FoodRowSpinner } from "./FoodRowSpinner";
import { Macros } from "./Macros";
import { SwipeToDelete } from "./SwipeToDelete";

import type { FoodRowProps } from "./types";
import type { ReactNode } from "react";
import type { PressableProps } from "react-native";

// The title is 16 over 22 where body is 16 over 24, as the boards draw a food name. A matched part is
// the semibold weight and the rest the regular, so the match reads in bold.
const titleClassName = "leading-[22px]";

// The row's own look in each layout. The M2 row is a button with its divider on itself. The food log rows
// keep the divider on a wrapper, so the add button can sit beside the row and not inside it.
const rowClassName = {
  classic: "min-h-[60px] flex-row items-center gap-3 px-3 py-2",
  search: "min-h-[60px] flex-row items-center gap-3 py-2 pl-3 pr-1",
  recent: "min-h-[56px] flex-row items-center gap-3 py-2 pl-3 pr-1",
  diary: "min-h-[56px] flex-row items-center gap-3 bg-surface py-2 pl-4 pr-3",
} as const;

// The gap between the title, the serving and the stats: 4 points, and 2 on a diary row.
const textColumnClassName = {
  classic: "flex-1 gap-1",
  search: "min-w-0 flex-1 gap-1",
  recent: "min-w-0 flex-1 gap-1",
  diary: "min-w-0 flex-1 gap-[2px]",
} as const;

const deleteAction = { name: "delete", label: FOOD_ROW.deleteAction } as const;

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
  layout,
  caption,
  needsReview = false,
  onAdd,
  addDisabled = false,
  onDelete,
  startsSwiped,
  isSwiped,
  onSwipedChange,
  onPress,
}: FoodRowProps) {
  const { isFirst } = useGroupedRowPosition();
  const isBusy = busyLabel !== undefined;
  const isDiary = layout === "diary";
  const isLog = layout !== undefined;
  const name = nameSegments.map((segment) => segment.text).join("");
  const spokenEnergy =
    isBusy || energy === undefined ? undefined : `${energy} ${FOOD_ROW.energyUnit}`;
  const showsAdd =
    (layout === "search" || layout === "recent") && onAdd !== undefined && !needsReview && !isBusy;
  const canDelete = isDiary && onDelete !== undefined && !isBusy;

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
  } else if (isLog && (energy !== undefined || needsReview)) {
    // The food log shows the energy on the stats line, in the macros' own line, and reads it first. A food
    // that needs review says so there even with no energy to show.
    detailLine = <Macros energy={energy} macros={macros} needsReview={needsReview} />;
    spokenDetail = describeFoodRowStats(
      needsReview || macros === undefined
        ? { energy }
        : { energy, protein: macros.protein, carbs: macros.carbs, fat: macros.fat },
    );
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
  const label = [
    name,
    brand,
    isLog ? caption : undefined,
    spokenDetail,
    isLog ? undefined : spokenEnergy,
  ]
    .filter(Boolean)
    .join(", ");

  // A diary row and a Recent row write the whole name in semibold, because nothing is matched on either.
  const titleVariant = (matched: boolean) =>
    isDiary || layout === "recent" || matched ? "body-strong" : "body";
  const rowContent = (
    <>
      {isDiary ? null : (
        <View className="h-control-sm w-control-sm shrink-0 items-center justify-center rounded-small bg-surface-raised">
          <Icon name="Utensils" tone="secondary" />
        </View>
      )}
      <View className={textColumnClassName[layout ?? "classic"]}>
        <Text className={titleClassName} numberOfLines={2}>
          {nameSegments.map((segment, index) => (
            <Text
              // The segments are cut from one name, so their order never changes.
              key={index}
              className={titleClassName}
              variant={titleVariant(segment.matched)}
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
        {isLog && caption !== undefined ? (
          <Text numberOfLines={1} tone="muted" variant="caption">
            {caption}
          </Text>
        ) : null}
        {detailLine}
      </View>
      {isBusy ? (
        <FoodRowSpinner />
      ) : (
        <>
          {energy === undefined || isLog ? null : (
            <View className="shrink-0 flex-row items-baseline gap-[3px]">
              <Text variant="numeral-small">{energy}</Text>
              <Text tone="muted" variant="caption">
                {FOOD_ROW.energyUnit}
              </Text>
            </View>
          )}
          {showsAdd || onPress === undefined ? null : (
            <Icon name="ChevronRight" size="sm" tone="muted" />
          )}
        </>
      )}
    </>
  );

  const divider = isFirst ? "" : "border-t border-border";
  const dimmed = disabled && !isBusy ? "opacity-50" : "";
  const rowClasses = `${rowClassName[layout ?? "classic"]} ${layout === undefined ? divider : ""} ${dimmed}`;
  const actions = canDelete ? [deleteAction] : undefined;
  const onAction: PressableProps["onAccessibilityAction"] = canDelete
    ? ({ nativeEvent }) => {
        if (nativeEvent.actionName === deleteAction.name) {
          onDelete();
        }
      }
    : undefined;
  // A row with nothing to open is plain text: not a button, so a screen reader does not offer a press.
  const row =
    onPress === undefined ? (
      <View
        accessible
        accessibilityActions={actions}
        aria-label={label}
        className={rowClasses}
        onAccessibilityAction={onAction}
      >
        {rowContent}
      </View>
    ) : (
      <PressableSurface
        accessibilityActions={actions}
        busy={isBusy}
        className={rowClasses}
        disabled={disabled}
        label={label}
        pressScale={rowPressScale}
        onAccessibilityAction={onAction}
        onPress={onPress}
      >
        {rowContent}
      </PressableSurface>
    );

  if (!isLog) {
    return row;
  }
  return (
    <View className={`flex-row items-center ${divider}`}>
      <View className="min-w-0 flex-1">
        {canDelete ? (
          <SwipeToDelete
            isOpen={isSwiped}
            startsSwiped={startsSwiped}
            onDelete={onDelete}
            onOpenChange={onSwipedChange}
          >
            {row}
          </SwipeToDelete>
        ) : (
          row
        )}
      </View>
      {showsAdd ? (
        <IconButton
          disabled={addDisabled || disabled}
          icon="Plus"
          label={describeAddFood(name, caption)}
          variant="ring"
          onPress={onAdd}
        />
      ) : null}
    </View>
  );
}
