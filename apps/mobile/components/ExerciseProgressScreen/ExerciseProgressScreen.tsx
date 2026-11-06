import { useExerciseProgress } from "@keylow/api-client";
import { useState } from "react";

import { useNow } from "../../lib/useNow";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { ExerciseProgressView } from "../ExerciseProgressView";

import type { TrendRange } from "@keylow/core/training";

/** The range the graph opens on: 3 months. */
const DEFAULT_RANGE: TrendRange = "3m";

/**
 * The graph screen of one exercise, opened from a row of the Progress section by the exercise's id. Its Range
 * control starts on 3 months. A week selected on the chart, or in the list, stays selected while the range
 * changes, and emphasises nothing when the new range does not hold it. Back goes to the screen before it.
 */
export function ExerciseProgressScreen({
  exerciseId,
  onBack,
}: {
  exerciseId: string | undefined;
  onBack: () => void;
}) {
  const [range, setRange] = useState<TrendRange>(DEFAULT_RANGE);
  const [selectedWeek, setSelectedWeek] = useState<string | undefined>(undefined);
  const { title, body } = useExerciseProgress(exerciseId, range, {
    enabled: useReadsEnabled(),
    now: useNow(),
  });

  return (
    <ExerciseProgressView
      {...body}
      range={range}
      selectedWeek={selectedWeek}
      title={title}
      onBack={onBack}
      onChangeRange={setRange}
      onSelectWeek={setSelectedWeek}
    />
  );
}
