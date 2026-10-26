import type { LogContext } from "@keylow/core/diary";

export type LogPlateButtonProps = {
  /** The day (and hour) the sheet was opened for, which the plate is logged to. */
  context: LogContext;
};
