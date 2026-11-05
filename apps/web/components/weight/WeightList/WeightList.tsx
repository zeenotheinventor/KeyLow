import { WEIGHT_SCREEN } from "@keylow/core/copy";

import { WeighInRow } from "../WeighInRow";

import type { WeightListProps } from "./types";

import { GroupedList } from "@/components/ui/GroupedList";

/**
 * The Weigh-ins heading over a card of the weigh-ins, newest first. It is a plain list with no virtual
 * scrolling: a weigh-in is a short row, and the longest history a person keeps is some thousands.
 */
export function WeightList({ weighIns, today, isLeftOut, onOpen }: WeightListProps) {
  return (
    <GroupedList title={WEIGHT_SCREEN.listHeading}>
      {weighIns.map((weighIn) => (
        <WeighInRow
          key={weighIn.id}
          weighIn={weighIn}
          today={today}
          isLeftOut={isLeftOut(weighIn.local_date)}
          onOpen={onOpen}
        />
      ))}
    </GroupedList>
  );
}
