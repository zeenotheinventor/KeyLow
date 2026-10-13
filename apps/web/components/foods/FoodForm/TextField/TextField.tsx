import type { TextFieldProps } from "./types";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function TextField({ id, label, hint, error, className, ...inputProps }: TextFieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint === undefined ? null : hintId, error === undefined ? null : errorId]
    .filter((identifier) => identifier !== null)
    .join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={id}
        className={cn("h-11 md:h-9", className)}
        aria-invalid={error !== undefined}
        aria-describedby={describedBy === "" ? undefined : describedBy}
        {...inputProps}
      />
      {hint !== undefined && (
        <p id={hintId} className="text-sm text-text-muted">
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
