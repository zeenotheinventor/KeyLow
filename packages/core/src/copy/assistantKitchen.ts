/*
 * The words of the kitchen tools: the line shown while each one works, and the plain title a plan card
 * gets in "What the assistant changed". NOT ON THE CANVAS: no board draws the kitchen yet, so every line
 * here is a draft for Zee's approval. The tool names are the ones of the M9 plan, section 6.
 */
export const ASSISTANT_KITCHEN_WORKING_WORDS = {
  get_palate_profile: "Reading what you usually eat",
  suggest_recipe: "Writing a recipe for you",
  adjust_recipe: "Adjusting the recipe",
  plan_meals: "Planning your meals",
  replan_day: "Replanning the day",
} as const;

export const ASSISTANT_KITCHEN_CHANGE_TITLES = {
  plan_created: "Planned your meals",
  plan_day_replanned: "Replanned a day",
} as const;
