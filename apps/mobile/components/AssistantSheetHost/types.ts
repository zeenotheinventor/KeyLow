import type { ReactNode } from "react";

/** How the assistant sheet is opened: on which day, and from Describe in Log food, at what time. */
export type AssistantOpening = {
  /** The day on view in the diary, or the day being logged from Log food, `YYYY-MM-DD`. */
  localDate: string;
  /** The time of day, `HH:MM`, that Describe logs at. Leave it out to open the sheet as the diary's button does. */
  describeAt?: string | undefined;
};

export type AssistantSheetHostProps = {
  children: ReactNode;
};
