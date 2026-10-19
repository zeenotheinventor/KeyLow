import type { TodayCardContext, TodayCardWithSession } from "@keylow/core/copy";

export type TodayCardProps = {
  /** What `todayCard` gave for today. The first-time and no-routine cards have components of their own. */
  card: TodayCardWithSession;
  /** What the words need besides the card: today's date, the next set's exercise and the muscles recovering. */
  context: TodayCardContext;
  /**
   * Dims Start, Resume, Log another session and Log a session and stops them responding, since starting or
   * reopening a session needs a connection.
   */
  isStartAndResumeDisabled: boolean;
  /** Shows a spinner on Start, Log another session and Log a session and stops them responding, while the session is being started. */
  isStarting?: boolean | undefined;
  /** Starts the day's session: "Start Legs". Drawn only when it is given. */
  onStart?: (() => void) | undefined;
  /** Reopens the session in progress: "Resume Legs". Drawn only when it is given. */
  onResume?: (() => void) | undefined;
  /** Opens the finished session: "View session". Drawn only when it is given. */
  onViewSession?: (() => void) | undefined;
  /** Starts another session the same day, on the Done card: "Log another session". Drawn only when it is given. */
  onLogAnother?: (() => void) | undefined;
  /** Starts a free session on a rest day: "Log a session". Drawn only when it is given. */
  onLogSession?: (() => void) | undefined;
};
