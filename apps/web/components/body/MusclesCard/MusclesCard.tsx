import {
  BODY_MAP,
  describeGapListRow,
  describeVolumeListRow,
  describeWebListCaption,
} from "@keylow/core/copy";
import { List } from "lucide-react";
import { useId } from "react";

import type { MusclesCardProps } from "./types";

import { MuscleRow } from "@/components/body/MuscleRow";
import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";

// The swatch of each status on Volume and Gap, written out so Tailwind sees the classes.
const volumeSwatchClassNames = {
  not_trained: "bg-volume-not-trained",
  maintaining: "bg-volume-maintaining",
  growing: "bg-volume-growing",
  productive: "bg-volume-productive",
  high: "bg-volume-high",
} as const;
const gapSwatchClassNames = {
  behind: "bg-gap-behind",
  on_plan: "bg-gap-on-plan",
  ahead: "bg-gap-ahead",
} as const;

/**
 * The Muscles card of the body map, as `web-body, actual-heat`, `web-body, volume` and `web-body, gap` draw it
 * from 700 px up: the muscles the scale on screen lists (above rest and hottest first on Heat, at Growing or
 * above and most sets first on Volume, furthest behind first on Gap) under a line that says how many more are
 * left out. Below that the board draws only the Muscle list row, so the rows are hidden there and the row alone
 * stays. The row also sits at the foot of the card from 700 px up, where the board has none, because otherwise
 * "10 more at rest" has no way to them. The page it opens is Heat's list on every scale. A row opens that
 * muscle's sheet, and states its status and figure in words, so the colour of its swatch is never the only signal.
 */
export function MusclesCard({ list, view, weekEnd, listHref, onOpenMuscle }: MusclesCardProps) {
  const headingId = useId();

  function renderRows() {
    if (list === null) {
      return null;
    }
    const open = (muscle: Parameters<typeof onOpenMuscle>[0]) => (rowElement: HTMLElement) => {
      onOpenMuscle(muscle, rowElement);
    };
    if ("moreAtRest" in list) {
      return list.rows.map((row) => (
        <MuscleRow key={row.muscle} row={row} onOpen={open(row.muscle)} />
      ));
    }
    if (list.scale === "volume") {
      return list.rows.map((row) => (
        <MuscleRow
          key={row.muscle}
          words={describeVolumeListRow({ ...row, view, weekEnd })}
          swatchClassName={volumeSwatchClassNames[row.status]}
          onOpen={open(row.muscle)}
        />
      ));
    }
    return list.rows.map((row) => (
      <MuscleRow
        key={row.muscle}
        words={describeGapListRow(row)}
        swatchClassName={gapSwatchClassNames[row.status]}
        onOpen={open(row.muscle)}
      />
    ));
  }

  return (
    <Card padding="none">
      {list === null ? null : (
        <section aria-labelledby={headingId} className="hidden min-[700px]:block">
          <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3">
            <h2 id={headingId} className="text-body-strong">
              {BODY_MAP.listTitle}
            </h2>
            <span className="text-caption text-text-muted">
              {"moreAtRest" in list
                ? describeWebListCaption({ scale: "heat", moreAtRest: list.moreAtRest })
                : describeWebListCaption(list)}
            </span>
          </div>
          <ul className="divide-y divide-border border-t border-border">{renderRows()}</ul>
        </section>
      )}
      <ul className={list === null ? "" : "min-[700px]:border-t min-[700px]:border-border"}>
        <ListRow icon={List} title={BODY_MAP.muscleListButton} href={listHref} />
      </ul>
    </Card>
  );
}
