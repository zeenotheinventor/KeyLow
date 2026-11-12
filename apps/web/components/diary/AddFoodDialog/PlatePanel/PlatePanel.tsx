import {
  DIARY_PROBLEMS,
  FOOD_ROW,
  MACRO_NAMES,
  PLATE,
  describeFoodCount,
  describePlateDay,
} from "@keylow/core/copy";
import { formatCalories, formatGrams } from "@keylow/core/format";
import {
  isPlateItemValid,
  plateItemName,
  plateItemValues,
  plateTotals,
  plateUnitWord,
  plateUnitWords,
} from "@keylow/core/plate";

import type { PlatePanelProps } from "./types";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MacroProgressStrip } from "@/components/ui/MacroProgressStrip";
import { PlateRow } from "@/components/ui/PlateRow";
import { TimeField } from "@/components/ui/TimeField";

// The classes are written out so Tailwind sees them.
const macroMarks = [
  { macro: "protein", totalKey: "protein_g", markClassName: "bg-protein" },
  { macro: "carbs", totalKey: "carbs_g", markClassName: "bg-carbs" },
  { macro: "fat", totalKey: "fat_g", markClassName: "bg-fat" },
] as const;

/**
 * What Your plate holds, drawn from the plate's state with no store of its own: the heading with the count and
 * Clear plate, the rows with their amounts, what the plate comes to (and under a hairline what the day comes to
 * with it, as the same four bars the search shows, drawn on the card) and the plate's one Time row. The rows and
 * the totals scroll, so a long plate never pushes the Time row out of reach. The panel fills the height it is
 * given.
 */
export function PlatePanel({
  items,
  dayBars,
  time,
  isNow,
  onTimeChange,
  onAmountChange,
  onRemove,
  onClear,
  onOpenRow,
  isOpenDisabled = false,
  isLogging = false,
  resultsLink,
  headingRef,
  notice,
}: PlatePanelProps) {
  const totals = plateTotals(items);

  return (
    <section aria-label={PLATE.title} className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex min-h-9 shrink-0 items-center gap-2">
        {resultsLink !== undefined && <div className="-mr-1 flex shrink-0">{resultsLink}</div>}
        <div className="flex items-baseline gap-2">
          <h3 ref={headingRef} tabIndex={-1} className="text-h2 outline-none">
            {PLATE.title}
          </h3>
          <span className="text-caption text-text-muted">{describeFoodCount(items.length)}</span>
        </div>
        {/* The label's end lines up with the panel's edge, as the board draws it. */}
        <Button
          type="button"
          variant="ghost"
          tone="danger"
          size="sm"
          className="-mr-3 ml-auto"
          disabled={isLogging}
          onClick={onClear}
        >
          {PLATE.clear}
        </Button>
      </div>
      {notice}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        <Card asChild padding="none">
          <ul aria-label={PLATE.rowsLabel} className="shrink-0 divide-y divide-border">
            {items.map((item) => {
              const values = plateItemValues(item);

              return (
                <PlateRow
                  key={item.key}
                  name={plateItemName(item)}
                  isRecipe={item.kind === "recipe"}
                  energy={formatCalories(values.kcal)}
                  macros={{
                    protein: formatGrams(values.protein_g),
                    carbs: formatGrams(values.carbs_g),
                    fat: formatGrams(values.fat_g),
                  }}
                  amountText={item.quantityText}
                  unitWord={plateUnitWord(item)}
                  unitsWord={plateUnitWords(item).plural}
                  error={isPlateItemValid(item) ? undefined : DIARY_PROBLEMS.quantity}
                  disabled={isLogging}
                  isOpenDisabled={isOpenDisabled}
                  onAmountChange={(text) => {
                    onAmountChange(item.key, text);
                  }}
                  onRemove={() => {
                    onRemove(item.key);
                  }}
                  {...(onOpenRow === undefined
                    ? {}
                    : {
                        onOpen: () => {
                          onOpenRow(item);
                        },
                      })}
                />
              );
            })}
          </ul>
        </Card>
        <Card asChild padding="none">
          <section aria-label={PLATE.totalsLabel} className="shrink-0">
            <div className="flex flex-col gap-2 px-4 py-3">
              <div className="flex items-baseline justify-between">
                <span className="text-body-strong">{PLATE.onYourPlate}</span>
                <span className="text-body-strong tabular-nums">
                  {formatCalories(totals.kcal)}
                  <span className="text-caption font-normal text-text-muted">
                    {" "}
                    {FOOD_ROW.energyUnit}
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {macroMarks.map(({ macro, totalKey, markClassName }) => (
                  <span
                    key={macro}
                    className="inline-flex items-center gap-1 text-caption text-text-secondary"
                  >
                    <span aria-hidden className={`size-[6px] rounded-[2px] ${markClassName}`} />
                    {`${MACRO_NAMES[macro]} ${formatGrams(totals[totalKey])} g`}
                  </span>
                ))}
              </div>
              {dayBars !== undefined && (
                <div className="mt-1 flex flex-col gap-2 border-t border-border pt-3">
                  <span className="text-caption text-text-secondary">
                    {describePlateDay(dayBars.dayTitle)}
                  </span>
                  <MacroProgressStrip
                    bars={dayBars.bars}
                    label={describePlateDay(dayBars.dayTitle)}
                    surface="card"
                  />
                </div>
              )}
            </div>
          </section>
        </Card>
      </div>
      <TimeField row value={time} isNow={isNow} disabled={isLogging} onChange={onTimeChange} />
    </section>
  );
}
