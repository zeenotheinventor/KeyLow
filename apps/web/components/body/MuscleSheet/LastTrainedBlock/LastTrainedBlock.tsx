import type { LastTrainedBlockProps } from "./types";

/** When the muscle was last trained, under a hairline: the day and the routine day, then the exercises that worked it. */
export function LastTrainedBlock({ lastTrained }: LastTrainedBlockProps) {
  return (
    <div className="flex flex-col gap-[2px] border-t border-border pt-3">
      <span className="text-caption text-text-muted">{lastTrained.label}</span>
      <span className="text-body-strong">{lastTrained.value}</span>
      {lastTrained.exercises === null ? null : (
        <span className="text-caption text-text-secondary">{lastTrained.exercises}</span>
      )}
    </div>
  );
}
