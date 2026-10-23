import type { SetEntryOpening, SetEntrySheetProps } from "../types";

export type SetEntryFormProps = Pick<
  SetEntrySheetProps,
  "sessionId" | "unit" | "setType" | "onChangeSetType" | "onLogSet"
> & {
  entry: SetEntryOpening;
  /** Called once the set is stored. */
  onLogged: () => void;
  onPressSetNumber: (() => void) | undefined;
};
