import type {
  BodyMapView,
  MuscleId,
  MusclesAboveRest,
  MusclesAgainstPlan,
  MusclesByVolume,
} from "@keylow/core/training";

/** The rows of the card for the scale on screen: Heat's, Volume's or Gap's. */
export type MusclesCardList = MusclesAboveRest | MusclesByVolume | MusclesAgainstPlan;

export type MusclesCardProps = {
  /** The rows for the scale on screen and how many are left out, or null while the list is not read. The Muscle list link shows either way. */
  list: MusclesCardList | null;
  /** The view on screen, which Volume's rows name their sets by ("so far this week" or "by Sunday"). */
  view: BodyMapView;
  /** The Sunday that ends the week, `YYYY-MM-DD`, which Volume in Projected counts to. */
  weekEnd: string;
  /** The muscle list page, which holds every muscle. */
  listHref: string;
  /** Opens the muscle's sheet, and is given the clicked row so the sheet can return focus to it. */
  onOpenMuscle: (muscle: MuscleId, row: HTMLElement) => void;
};
