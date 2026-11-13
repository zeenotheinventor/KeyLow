import type { AssistantOpenedFrom } from "@keylow/core";
import type { ReactNode } from "react";

/** How the assistant sheet is opened: on which day, from the Train header, and from Describe in Log food, at what time. */
export type AssistantOpening = {
  /** The day on view in the diary, or the day being logged from Log food, `YYYY-MM-DD`. */
  localDate: string;
  /** The time of day, `HH:MM`, that Describe logs at. Leave it out to open the sheet as the diary's button does. */
  describeAt?: string | undefined;
  /** The screen whose header opens the sheet, when it is not the diary's. */
  from?: AssistantOpenedFrom | undefined;
  /**
   * Words to open the composer with, which are never sent: the person adds to them and presses Send. The meal
   * plan's Regenerate day and Plan my week use it. The keyboard comes up with them.
   */
  draft?: string | undefined;
};

export type AssistantSheetHostProps = {
  children: ReactNode;
};
