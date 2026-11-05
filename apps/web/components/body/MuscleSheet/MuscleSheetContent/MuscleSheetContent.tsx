import { NotTrainedSheetBody } from "../NotTrainedSheetBody";
import { TrainedSheetBody } from "../TrainedSheetBody";

import type { MuscleSheetContentProps } from "./types";

/**
 * The line under the muscle's name, then the layout of a muscle with sets this week, or of one with none.
 * The dialog holds the name as its heading and the Close button.
 */
export function MuscleSheetContent({ copy, detail }: MuscleSheetContentProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-caption text-text-secondary">{copy.subtitle}</p>
      {copy.kind === "trained" ? (
        <TrainedSheetBody copy={copy} detail={detail} />
      ) : (
        <NotTrainedSheetBody copy={copy} detail={detail} />
      )}
    </div>
  );
}
