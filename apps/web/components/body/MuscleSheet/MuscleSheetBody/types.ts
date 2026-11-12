import type { BodyMapDay } from "@keylow/api-client";
import type { BodyMapView, MuscleId } from "@keylow/core/training";

export type MuscleSheetBodyProps = {
  muscle: MuscleId;
  /** The view on screen, which decides the volume status the sets bar is filled in. */
  view: BodyMapView;
  /** The day on screen, `YYYY-MM-DD`, a day of the week. Left out for the current moment. */
  at?: string | undefined;
  /** The Monday that starts the week, `YYYY-MM-DD`. */
  weekStart: string;
  /** The current moment, an ISO timestamp with a zone. */
  now: string;
  /** The seven days of the week, whose planned ones the sheet names as the sessions still to come. */
  days: readonly BodyMapDay[];
  /** Opens the routine editor. The Not trained sheet draws its Edit routine button only when this is given. */
  onEditRoutine?: (() => void) | undefined;
};
