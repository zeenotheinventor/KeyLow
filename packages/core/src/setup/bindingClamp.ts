/** The guardrails that set the calorie number, as the setup layer records them. */
export type CalorieClampCode = "profile_max" | "floor" | "max_deficit" | "max_surplus";

/**
 * From the clamp that set the final number to the clamp that was applied first. `deriveCalorieTarget` applies
 * the deficit cap, then the floor, so the floor is the later one whenever both are recorded. The 6000 profile
 * maximum is applied by the setup layer after the engine, so it comes last of all. A lose goal never has the
 * surplus cap and a gain goal never has the other two, so their place relative to each other does not matter.
 */
const CLAMPS_LATEST_FIRST: readonly CalorieClampCode[] = [
  "profile_max",
  "floor",
  "max_deficit",
  "max_surplus",
];

/**
 * The one calorie clamp that set the final number, or undefined when none did. It takes plain strings, so the
 * clamp list of the engine or of the setup layer can be passed as it is, and any code that does not set the
 * calories (`max_rate`, `macro_fit`, a day-of-week code) is ignored. This is the clamp whose guardrail line is
 * shown, so that two lines never contradict: when the deficit cap and the floor both apply, the floor's shows.
 */
export function bindingCalorieClamp(clamps: readonly string[]): CalorieClampCode | undefined {
  return CLAMPS_LATEST_FIRST.find((code) => clamps.includes(code));
}
