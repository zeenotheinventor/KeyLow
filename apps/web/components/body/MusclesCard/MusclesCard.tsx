import { BODY_MAP, describeWebListCaption } from "@keylow/core/copy";
import { List } from "lucide-react";
import { useId } from "react";

import type { MusclesCardProps } from "./types";

import { MuscleRow } from "@/components/body/MuscleRow";
import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";

/**
 * The Muscles card of the body map on Heat: the muscles above rest, hottest first, under a line that says how
 * many more are at rest, as `web-body, actual-heat` draws it from 700 px up. Below that the board draws only
 * the Muscle list row, so the rows are hidden there and the row alone stays. The row also sits at the foot of
 * the card from 700 px up, where the board has none, because otherwise "10 more at rest" has no way to them.
 * A row opens that muscle's sheet.
 */
export function MusclesCard({ list, listHref, onOpenMuscle }: MusclesCardProps) {
  const headingId = useId();

  return (
    <Card padding="none">
      {list === null ? null : (
        <section aria-labelledby={headingId} className="hidden min-[700px]:block">
          <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3">
            <h2 id={headingId} className="text-body-strong">
              {BODY_MAP.listTitle}
            </h2>
            <span className="text-caption text-text-muted">
              {describeWebListCaption({ scale: "heat", moreAtRest: list.moreAtRest })}
            </span>
          </div>
          <ul className="divide-y divide-border border-t border-border">
            {list.rows.map((row) => (
              <MuscleRow
                key={row.muscle}
                row={row}
                onOpen={(rowElement) => {
                  onOpenMuscle(row.muscle, rowElement);
                }}
              />
            ))}
          </ul>
        </section>
      )}
      <ul className={list === null ? "" : "min-[700px]:border-t min-[700px]:border-border"}>
        <ListRow icon={List} title={BODY_MAP.muscleListButton} href={listHref} />
      </ul>
    </Card>
  );
}
