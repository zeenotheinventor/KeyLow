import {
  PROGRAM_TARGETS_SCREEN,
  TARGETS_SCREEN,
  describeTargetsScreenSince,
} from "@keylow/core/copy";
import { formatCalories, formatGrams } from "@keylow/core/format";
import { ChartLine } from "lucide-react";

import type { EngineTargetsProps } from "./types";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";

/**
 * The Targets page while a programme runs (`program-targets-engine`): the Programme row, this week's four targets
 * as rows that go nowhere, the note, and Set my own targets at the end of the column. The figures are the ones
 * read, so they stay as read without a connection, and Set my own targets, which saves, is off.
 */
export function EngineTargets({ targets, since, isOnline, onSetOwnTargets }: EngineTargetsProps) {
  const { kcal, protein_g, carbs_g, fat_g } = targets;

  return (
    <>
      <Card asChild padding="none">
        <ul>
          <ListRow
            icon={ChartLine}
            title={PROGRAM_TARGETS_SCREEN.programRow.title}
            subtitle={PROGRAM_TARGETS_SCREEN.programRow.subtitle}
            href="/more/program"
          />
        </ul>
      </Card>
      <section aria-label={PROGRAM_TARGETS_SCREEN.thisWeekList} className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2 px-1">
          <h2 className="text-body-strong">{PROGRAM_TARGETS_SCREEN.thisWeek}</h2>
          {since !== undefined && (
            <span className="text-caption tabular-nums text-text-muted">
              {describeTargetsScreenSince(since)}
            </span>
          )}
        </div>
        <Card asChild padding="none">
          <ul className="divide-y divide-border">
            <ListRow
              macro="calories"
              title={TARGETS_SCREEN.calories}
              value={kcal === null ? undefined : formatCalories(kcal)}
              unit={kcal === null ? undefined : "kcal"}
              valueLook="numeral"
            />
            <ListRow
              macro="protein"
              title={TARGETS_SCREEN.protein}
              value={protein_g === null ? undefined : formatGrams(protein_g)}
              unit={protein_g === null ? undefined : "g"}
              valueLook="numeral"
            />
            <ListRow
              macro="carbs"
              title={TARGETS_SCREEN.carbs}
              value={carbs_g === null ? undefined : formatGrams(carbs_g)}
              unit={carbs_g === null ? undefined : "g"}
              valueLook="numeral"
            />
            <ListRow
              macro="fat"
              title={TARGETS_SCREEN.fat}
              value={fat_g === null ? undefined : formatGrams(fat_g)}
              unit={fat_g === null ? undefined : "g"}
              valueLook="numeral"
            />
          </ul>
        </Card>
      </section>
      <p className="px-1 text-caption text-text-muted">{PROGRAM_TARGETS_SCREEN.engineNote}</p>
      <div className="flex md:justify-end">
        <Button
          variant="secondary"
          // The board draws it full width and large on a phone, and the usual size to the right from the medium width.
          className="w-full max-md:h-control-lg max-md:px-5 md:w-auto"
          disabled={!isOnline}
          onClick={onSetOwnTargets}
        >
          {PROGRAM_TARGETS_SCREEN.setOwnTargetsLabel}
        </Button>
      </div>
    </>
  );
}
