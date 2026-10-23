import { WEIGHT_SCREEN } from "@keylow/core/copy";
import { FlatList, View } from "react-native";

import { GroupedRowPositionContext, Text } from "../../ui";
import { WeighInRow } from "../WeighInRow";

import type { WeightListProps } from "./types";
import type { WeighIn } from "@keylow/api-client";

// A daily weigher has hundreds of rows, so the list draws the ones near the screen: a screen shows about ten.
const INITIAL_ROWS = 12;

const firstRow = { isFirst: true };
const followingRow = { isFirst: false };

/**
 * The Weigh-ins heading over the weigh-ins, newest first, in one list that scrolls with whatever the
 * screen puts above it (`header`). The board draws the rows in a single card. A virtualised list draws
 * only some of its rows, so each row draws its own part of the card's edge: the first its top and sides,
 * the last its bottom, and the ones between their sides. The board's list card has no shadow.
 */
export function WeightList({ weighIns, today, isLeftOut, header }: WeightListProps) {
  function renderRow({ item, index }: { item: WeighIn; index: number }) {
    const edgeClassName = [
      index === 0 ? "rounded-t-large border-t" : "",
      index === weighIns.length - 1 ? "rounded-b-large border-b" : "",
    ].join(" ");

    return (
      <View className={`overflow-hidden border-x border-border bg-surface ${edgeClassName}`}>
        <GroupedRowPositionContext value={index === 0 ? firstRow : followingRow}>
          <WeighInRow isLeftOut={isLeftOut(item.local_date)} today={today} weighIn={item} />
        </GroupedRowPositionContext>
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1"
      contentContainerClassName="pb-4"
      data={weighIns}
      initialNumToRender={INITIAL_ROWS}
      keyExtractor={(weighIn) => weighIn.id}
      ListHeaderComponent={
        <View className="gap-3 pb-2">
          {header}
          <Text className="px-1" role="heading" variant="body-strong">
            {WEIGHT_SCREEN.listHeading}
          </Text>
        </View>
      }
      renderItem={renderRow}
    />
  );
}
