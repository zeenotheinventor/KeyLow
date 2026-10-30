import { useLastPerformance } from "@keylow/api-client";
import {
  SESSION_ACTIVE,
  describeSetCellName,
  describeSetColumns,
  describeSetInputError,
  describeSetRow,
  isWordedSetInputRule,
} from "@keylow/core/copy";
import {
  exerciseSetRows,
  prefillNextSet,
  sameAgain,
  setDraftOfValues,
  setValuesOfPrefill,
  validateSetDraft,
} from "@keylow/core/training";
import { Plus } from "lucide-react";
import { useRef, useState } from "react";

import type { RowEdits, SessionExerciseCardProps } from "./types";
import type {
  SetTableColumn,
  SetTableEntryRow,
  SetTableLoggedRow,
} from "@/components/train/SetTable";
import type { SetDraft, SetDraftIssue, SetType } from "@keylow/core/training";

import { SetTable } from "@/components/train/SetTable";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const BLANK_DRAFT: Pick<SetDraft, SetTableColumn> = { load: "", reps: "", rir: "" };

const withoutRow = <Value,>(
  rows: Readonly<Record<string, Value>>,
  key: string,
): Readonly<Record<string, Value>> =>
  Object.fromEntries(Object.entries(rows).filter(([rowKey]) => rowKey !== key));

/**
 * One exercise of the session in progress, as the `web-session · active` board draws it: its name and target
 * line, the table of its sets and Add set. The Previous column is read from the exercise's latest earlier
 * session, so with no connection (or until it arrives) every Previous is a dash and the rest is unchanged.
 *
 * The next set's fields open filled with the numbers the mobile entry sheet opens with (`prefillNextSet`), and
 * the sets after it are blank. The check of a row to log checks the numbers its fields hold and logs the set,
 * or says under the row what rule they break. What is typed stays in its row until the set is logged, so a
 * write that fails brings the row back as it was typed. The check of a logged row removes it. Add set adds one
 * more row, filled with the same again of the exercise's last set, or as the next row is when nothing is
 * logged yet. The added rows are kept as the fewest rows the card must show: logging any set raises the sets
 * done and leaves the rows as many, and a row added while none is left to log stays until a set is logged.
 */
export function SessionExerciseCard({
  sessionId,
  name,
  target,
  plan,
  unit,
  exercise,
  sessionSets,
  logging,
}: SessionExerciseCardProps) {
  const lastPerformance = useLastPerformance(exercise.exerciseId, {
    excludeSessionId: sessionId,
  });
  const [edits, setEdits] = useState<RowEdits>({});
  const [issuesByRow, setIssuesByRow] = useState<
    Readonly<Record<string, readonly SetDraftIssue[]>>
  >({});
  const [minimumRows, setMinimumRows] = useState(0);
  const addSetRef = useRef<HTMLButtonElement>(null);
  const [latestSession] = lastPerformance.data ?? [];
  const previousSets = latestSession?.sets ?? [];
  const { exerciseId } = exercise;
  const rows = exerciseSetRows(exercise, sessionSets, previousSets);
  const valuesToLog = setValuesOfPrefill(prefillNextSet(exerciseId, sessionSets, previousSets));
  const lastSet = exercise.rows.flatMap(({ set }) => (set === null ? [] : [set])).at(-1);
  const valuesToAdd = lastSet === undefined ? valuesToLog : sameAgain(lastSet);
  const addedCount = Math.max(minimumRows - rows.length, 0);

  // A logged row is a new element, so the focus on its check is lost. After a log made from the keyboard it
  // goes to the first field of the next set to log below it in this card, or to Add set when none is left.
  // The rows below keep their keys, so their fields survive the log.
  const focusAfterLog = (check: HTMLElement) => {
    for (let row = check.closest("tr")?.nextElementSibling; row; row = row.nextElementSibling) {
      const field = row.querySelector("input");
      if (field !== null) {
        field.focus();
        return;
      }
    }
    addSetRef.current?.focus();
  };

  // Removing a set takes a row away only when the sets done are beyond the plan, or it is a warm-up (which
  // the plan never counts), so only then does the fewest rows the card must show come down with it.
  const workingDoneCount = rows.filter(
    ({ state, setType }) => state === "done" && setType !== "warmup",
  ).length;
  const removalTakesARow = (setType: SetType) =>
    setType === "warmup" || plan === null || workingDoneCount > plan.sets;

  const entryRowOf = ({
    key,
    state,
    setType,
    setNumber,
    previous,
    defaults,
  }: Pick<SetTableEntryRow, "key" | "state" | "setType"> & {
    setNumber: number;
    previous: Parameters<typeof describeSetRow>[0]["previous"];
    defaults: Pick<SetDraft, SetTableColumn>;
  }): SetTableEntryRow => {
    const draft: SetDraft = {
      setType,
      rpe: "",
      load: edits[key]?.load ?? defaults.load,
      reps: edits[key]?.reps ?? defaults.reps,
      rir: edits[key]?.rir ?? defaults.rir,
    };
    const result = validateSetDraft(draft, { unit, effortMode: "rir" });
    const issues = issuesByRow[key] ?? [];
    const copy = describeSetRow({
      setType,
      setNumber,
      unit,
      previous,
      entry: result.ok
        ? { state: "ready", loadKg: result.values.loadKg, reps: result.values.reps }
        : { state: "empty" },
    });
    const field = (column: SetTableColumn) => ({
      name: describeSetCellName({ exerciseName: name, setType, setNumber, unit, column }),
      value: draft[column],
      invalid: issues.some((issue) => issue.field === column),
      onChange: (value: string) => {
        setEdits((current) => ({ ...current, [key]: { ...current[key], [column]: value } }));
        setIssuesByRow((current) => withoutRow(current, key));
      },
    });

    return {
      key,
      state,
      setType,
      label: copy.label,
      previous: copy.previous,
      checkName: copy.accessibleName,
      fields: { load: field("load"), reps: field("reps"), rir: field("rir") },
      errors: [
        ...new Set(
          issues.flatMap(({ rule }) =>
            isWordedSetInputRule(rule) ? [describeSetInputError(rule, unit)] : [],
          ),
        ),
      ],
      onCheck: (event) => {
        if (result.ok) {
          logging.logSet({ exerciseId, values: result.values });
          // A click made with a key has no pointer position, so its detail is 0.
          if (event.detail === 0) {
            focusAfterLog(event.currentTarget);
          }
        } else {
          setIssuesByRow((current) => ({ ...current, [key]: result.issues }));
        }
      },
    };
  };

  const plannedAndLoggedRows = rows.map(
    ({
      setId,
      state,
      setType,
      setNumber,
      previous,
      entry,
    }): SetTableEntryRow | SetTableLoggedRow => {
      if (setId === null) {
        return entryRowOf({
          key: `planned-${setNumber}`,
          state: state === "next" ? "next" : "todo",
          setType,
          setNumber,
          previous,
          defaults:
            state === "next" && valuesToLog !== null
              ? setDraftOfValues(valuesToLog, unit)
              : BLANK_DRAFT,
        });
      }
      const copy = describeSetRow({ setType, setNumber, unit, previous, entry });
      return {
        key: setId,
        state: "done",
        setType,
        label: copy.label,
        previous: copy.previous,
        load: copy.load,
        reps: copy.reps,
        rir: copy.rir,
        checkName: copy.accessibleName,
        onCheck: logging.isSaving(setId)
          ? undefined
          : () => {
              if (removalTakesARow(setType)) {
                setMinimumRows((current) => Math.max(current - 1, 0));
              }
              setEdits({});
              logging.removeSet({ setId, exerciseName: name, setType, setNumber });
            },
      };
    },
  );

  const workingRowCount = rows.filter(({ setType }) => setType !== "warmup").length;
  const addedRows = Array.from({ length: addedCount }, (_, index) => {
    const setType = valuesToAdd?.setType ?? "working";
    return entryRowOf({
      key: `added-${index + 1}`,
      state: "todo",
      setType,
      setNumber: setType === "warmup" ? 0 : workingRowCount + index + 1,
      previous: null,
      defaults: valuesToAdd === null ? BLANK_DRAFT : setDraftOfValues(valuesToAdd, unit),
    });
  });

  return (
    <Card asChild padding="none" className="flex flex-col pb-2 pt-3">
      <section aria-label={name}>
        {/* The header keeps room at its end for the muscles button of the exercise. */}
        <div className="flex items-baseline justify-between gap-3 px-4 pb-2">
          <h2 className="min-w-0 text-body-strong">{name}</h2>
          <span className="shrink-0 text-caption text-text-muted">{target}</span>
        </div>
        <SetTable
          columns={describeSetColumns(unit)}
          rows={[...plannedAndLoggedRows, ...addedRows]}
        />
        <div className="px-2 pt-1">
          <Button
            ref={addSetRef}
            variant="ghost"
            size="sm"
            onClick={() => {
              setMinimumRows(rows.length + addedCount + 1);
            }}
          >
            <Plus aria-hidden />
            {SESSION_ACTIVE.addSetAction}
          </Button>
        </div>
      </section>
    </Card>
  );
}
