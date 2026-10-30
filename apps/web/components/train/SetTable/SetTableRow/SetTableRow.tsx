import { useId } from "react";

import { SetCheckButton } from "../SetCheckButton";

import type { SetTableColumn } from "../types";
import type { SetTableRowProps } from "./types";
import type * as React from "react";

import { NumericInput } from "@/components/ui/NumericInput";
import { cn } from "@/lib/utils";

const COLUMNS: readonly SetTableColumn[] = ["load", "reps", "rir"];

// Each field is a 36 px box in a 44 px row: the input has no unit after it, since the heading has it.
const fieldFrameClasses = "mx-auto h-control-sm w-full max-w-24 px-2";
const fieldClasses = "h-8 w-full min-w-0 text-center text-body-strong";

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
  const isLogged = row.state === "done";
  const markClasses = row.setType === "warmup" ? "text-warning-ink" : "text-text-secondary";

  return (
    <>
      <tr className={cn("h-11", isLogged && "bg-success-muted")}>
        <td className={cn("pl-3 text-label-small tabular-nums md:px-4", markClasses)}>
          {row.label}
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
