import type { PortionDraft } from "../usePortionDraft";
import type { Ref } from "react";

export type PortionStepProps = {
  draft: PortionDraft;
  /** The Time field's value, `HH:mm`. */
  time: string;
  /** The time is still the moment the dialog opened. */
  isNow: boolean;
  onTimeChange: (time: string) => void;
  /** The Results link: back to the search, with what was typed still in it. */
  onBack: () => void;
  /** Reaches the amount field, so the cursor can start in it. */
  amountRef?: Ref<HTMLInputElement> | undefined;
};
