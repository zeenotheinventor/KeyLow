import type { AssistantActionCardDay } from "../types";

export type RoutineDayRowProps = {
  day: AssistantActionCardDay;
  /** Whether the day's exercises are showing. The card holds it, so one day is open at a time. */
  isOpen: boolean;
  onPress: () => void;
};
