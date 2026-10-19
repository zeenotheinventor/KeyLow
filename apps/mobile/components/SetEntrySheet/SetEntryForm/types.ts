import type { SetEntryOpening, SetEntrySheetProps } from "../types";

export type SetEntryFormProps = Pick<SetEntrySheetProps, "sessionId" | "unit"> & {
  entry: SetEntryOpening;
  /** Called once the set is stored. */
  onLogged: () => void;
  onPressSetNumber: (() => void) | undefined;
};
