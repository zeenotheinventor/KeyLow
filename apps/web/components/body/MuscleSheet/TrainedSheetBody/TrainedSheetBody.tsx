import { HeatTile } from "../HeatTile";
import { LastTrainedBlock } from "../LastTrainedBlock";
import { StatTile } from "../StatTile";
import { WeeklySetsBar } from "../WeeklySetsBar";

import type { TrainedSheetBodyProps } from "./types";

/**
 * What the sheet of a muscle with sets this week holds under its header: the Heat and Ready tiles, the weekly sets block
 * with its bar, when the muscle was last trained, and the note on how sets are counted.
 */
export function TrainedSheetBody({ copy, detail }: TrainedSheetBodyProps) {
  const { heat, ready, weeklySets, lastTrained, weightingNote } = copy;

  return (
    <>
      <div className="flex gap-2">
        <HeatTile heat={heat} step={detail.heatStep} />
        <StatTile caption={ready.caption} label={ready.label} value={ready.value} />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3 text-caption">
          <span className="text-text-muted">{weeklySets.heading}</span>
          <span className="text-text-secondary">{weeklySets.plannedText}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-numeral-small">{weeklySets.done.value}</span>
          <span className="text-text-secondary">{weeklySets.done.caption}</span>
        </div>
        <WeeklySetsBar
          labels={weeklySets.barLabels}
          name={weeklySets.barName}
          weeklySets={detail.weeklySets}
        />
        <p>{weeklySets.position}</p>
      </div>
      <LastTrainedBlock lastTrained={lastTrained} />
      <p className="text-caption text-text-muted">{weightingNote}</p>
    </>
  );
}
