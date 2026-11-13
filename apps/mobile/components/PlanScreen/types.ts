import type { MealPlan, MealPlanDay } from "@keylow/api-client";
import type { PlanDayView } from "@keylow/core/plans";

/** What the Plan screens read: the live plans as core shapes them, today in the person's zone, and how the reads stand. */
export type PlanData = {
  /** One view for each date the live plans cover, the newest plan's day winning. Undefined until the plans are read. */
  views: PlanDayView[] | undefined;
  /** The live plans as stored, which the shopping list reads its days from. Undefined until they are read. */
  planRows: readonly MealPlan[] | undefined;
  /** The stored day a view was made from, which Confirm day writes from. */
  rawDayOf: (dayId: string) => MealPlanDay | undefined;
  /** The person's time zone, undefined until read. */
  timeZone: string | undefined;
  /** Today in that zone, `YYYY-MM-DD`. */
  today: string | undefined;
  /** A first read failed, so there is nothing to show. */
  isError: boolean;
  refetch: () => void;
};
