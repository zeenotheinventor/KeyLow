import type { TodayCardContext, TodayCardWithSession } from "@keylow/core/copy";

export type TodayCardProps = {
  /** What `todayCard` gave for today. The first-time and no-routine cards have components of their own. */
  card: TodayCardWithSession;
  /** What the words need besides the card: today's date, the next set's exercise and the muscles recovering. */
  context: TodayCardContext;
  /** Dims Start and Resume and stops them responding, since starting or reopening a session needs a connection. */
  isStartAndResumeDisabled: boolean;
  /** Starts the day's session: "Start Legs". Drawn only when it is given. */
  onStart?: (() => void) | undefined;
  /** Reopens the session in progress: "Resume Legs". Drawn only when it is given. */
  onResume?: (() => void) | undefined;
  /** Opens the finished session: "View session". Drawn only when it is given. */
  onViewSession?: (() => void) | undefined;
};
