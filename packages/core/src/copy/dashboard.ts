import { MACRO_NAMES, describeCalorieRing, describeMacroBar } from "./diaryRing";
import { formatCalories } from "../format/numbers";

/** The words of the dashboard's nutrition card, as the `dashboard` boards draw them. */
export const DASHBOARD_CARD = {
  title: "Today",
  regionName: "Today's nutrition",
  edit: "Edit",
  editName: "Edit targets",
} as const;

/** The name a screen reader reads while the card loads. */
export const DASHBOARD_LOADING_NAME = "Loading today's nutrition";

export const DASHBOARD_LOAD_FAILED = {
  title: "Couldn't load today's nutrition",
  body: "Check your connection and try again.",
  action: "Try again",
};

/** The card's footer, such as "Target 2,200 kcal". */
export const describeTargetCaption = (targetCalories: number): string =>
  `Target ${formatCalories(targetCalories)} kcal`;

type DashboardNutrients = {
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

/**
 * The name of the whole card, which is one button to the diary: "Today, open the diary", then the
 * ring's name and the three macros' names, joined with full stops. A total no entry gave a value for
 * reads as 0, and a target that is not set as none.
 */
export const describeDashboardCard = (
  eaten: DashboardNutrients,
  targets: DashboardNutrients,
): string =>
  [
    `${DASHBOARD_CARD.title}, open the diary`,
    describeCalorieRing(eaten.kcal ?? 0, targets.kcal ?? 0),
    describeMacroBar(MACRO_NAMES.protein, eaten.protein_g ?? 0, targets.protein_g ?? 0),
    describeMacroBar(MACRO_NAMES.carbs, eaten.carbs_g ?? 0, targets.carbs_g ?? 0),
    describeMacroBar(MACRO_NAMES.fat, eaten.fat_g ?? 0, targets.fat_g ?? 0),
  ].join(". ");
