import type { MusclesAboveRest, MuscleId } from "@keylow/core/training";

export type MusclesCardProps = {
  /** The muscles above rest and how many are left out, or null while the list is not read. The Muscle list link shows either way. */
  list: MusclesAboveRest | null;
  /** The muscle list page, which holds every muscle. */
  listHref: string;
  /** Opens the muscle's sheet, and is given the clicked row so the sheet can return focus to it. */
  onOpenMuscle: (muscle: MuscleId, row: HTMLElement) => void;
};
