import { ChevronRight } from "lucide-react";
import { useId } from "react";

import { SetCheckButton } from "../SetCheckButton";
import { SetMarkButton } from "../SetMarkButton";

import type { SetTableColumn } from "../types";
import type { SetTableRowProps } from "./types";
import type * as React from "react";

import { NumericInput } from "@/components/ui/NumericInput";
import { cn } from "@/lib/utils";

const COLUMNS: readonly SetTableColumn[] = ["load", "reps", "rir"];

// Each field is a 36 px box in a 44 px row: the input has no unit after it, since the heading has it.
const fieldFrameClasses = "mx-auto h-control-sm w-full max-w-24 px-2";
const fieldClasses = "h-8 w-full min-w-0 text-center text-body-strong";

// The button holds the set's text, and an invisible layer reaches over the whole row (the row is positioned),
// which is the hit area and takes the focus ring, as the phone's whole row presses.
const readOnlyButtonClasses =
  "block w-full cursor-pointer py-2 text-left text-inherit outline-none after:absolute after:inset-0 focus-visible:after:rounded-small focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-focus-ring";

/** Enter moves on to the next field of the row, and from the last one to the row's check. */
function moveOn(event: React.KeyboardEvent<HTMLInputElement>) {
  if (event.key !== "Enter") {
    return;
  }
  event.preventDefault();
  const controls = Array.from(
    event.currentTarget.closest("tr")?.querySelectorAll<HTMLElement>("input, button") ?? [],
  );
  controls[controls.indexOf(event.currentTarget) + 1]?.focus();
}

/** One set of the table: a logged set with its numbers as text, or a set to log with them as fields. */
export function SetTableRow({ row }: SetTableRowProps) {
  const errorId = useId();
  if (row.state === "readOnly") {
    const { edit } = row;
    return (
      // A row with a button is the box its hit area stretches over, so the whole row presses. Safari has not
      // always made a positioned `tr` a containing block, and then every overlay would stack on the table and
      // a press would open the last set. A transform makes it one in every engine, so both are given.
      <tr
        aria-label={row.name}
        className={cn(
          "h-10",
          edit !== undefined && "relative [transform:rotate(0)] hover:bg-surface-raised",
        )}
      >
        <td
          className={cn(
            "pl-3 text-label-small tabular-nums md:px-4",
            row.setType === "warmup" ? "text-warning-ink" : "text-text-secondary",
          )}
        >
          {row.label}
        </td>
        <td className="text-body tabular-nums">
          {edit === undefined ? (
            row.what
          ) : (
            <button
              type="button"
              aria-label={edit.name}
              className={readOnlyButtonClasses}
              onClick={edit.onPress}
            >
              {row.what}
            </button>
          )}
        </td>
        <td className="text-right text-caption tabular-nums text-text-secondary">{row.rir}</td>
        <td className="pr-3 md:pr-4">
          {edit === undefined ? null : (
            <ChevronRight aria-hidden className="ml-auto size-3.5 text-text-muted" />
          )}
        </td>
      </tr>
    );
  }
  const isLogged = row.state === "done";
  const markClasses = row.setType === "warmup" ? "text-warning-ink" : "text-text-secondary";

  return (
    <>
      <tr className={cn("h-11", isLogged && "bg-success-muted")}>
        <td className={cn("pl-3 text-label-small tabular-nums md:px-4", markClasses)}>
          {row.typeEdit === undefined ? (
            row.label
          ) : (
            <SetMarkButton
              name={row.typeEdit.name}
              label={row.label}
              onPress={row.typeEdit.onPress}
            />
          )}
        </td>
        <td className="text-caption tabular-nums text-text-muted">{row.previous}</td>
        {row.state === "done"
          ? [row.load, row.reps, row.rir].map((value, index) => (
              <td
                key={COLUMNS[index]}
                className="text-center text-body-strong tabular-nums text-text-primary"
              >
                {value}
              </td>
            ))
          : COLUMNS.map((column) => {
              const field = row.fields[column];
              return (
                <td key={column} className="px-0.5 align-middle">
                  <NumericInput
                    hideLabel
                    label={field.name}
                    value={field.value}
                    invalid={field.invalid}
                    describedBy={row.errors.length === 0 ? undefined : errorId}
                    placeholder="–"
                    frameClassName={fieldFrameClasses}
                    className={fieldClasses}
                    onChange={(event) => {
                      field.onChange(event.target.value);
                    }}
                    onKeyDown={moveOn}
                  />
                </td>
              );
            })}
        <td className="pr-3 text-right md:pr-4">
          <SetCheckButton name={row.checkName} isLogged={isLogged} onPress={row.onCheck} />
        </td>
      </tr>
      {row.state !== "done" && row.errors.length > 0 ? (
        <tr>
          <td colSpan={6} className="px-4 pb-2">
            <p id={errorId} role="alert" className="text-caption text-danger">
              {row.errors.join(" ")}
            </p>
          </td>
        </tr>
      ) : null}
    </>
  );
}
