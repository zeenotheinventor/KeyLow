/**
 * How the routine writes tell the person what happened. Each app passes its own toast in, because the
 * two draw a toast differently. The words are core's and arrive in the call.
 */
export type RoutineNotices = {
  /** A write did not go through: one danger toast with these words. */
  showFailure: (message: string) => void;
  /** A routine was archived: a toast with this action, which must still work after the screen is gone. */
  showArchived: (notice: { message: string; actionLabel: string; onAction: () => void }) => void;
};
