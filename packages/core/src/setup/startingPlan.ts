import { ageInYears } from "../dates";
import {
  DEFAULT_ENGINE_PARAMS,
  deriveTargets,
  effectiveRatePctPerWeek,
  initialExpenditure,
  splitMacros,
} from "../engine";
import { goalsAllowed } from "./goals";
import { capToProfileRange } from "./profileRange";
import { weightUnitToSave } from "./units";

import type { EngineParams } from "../engine";
import type { WeightUnit } from "../format";
import type { SetupAnswers, StartingPlan } from "./types";

/**
 * The estimate, the targets and the rows to save, from a complete set of answers on `today`
 * (`YYYY-MM-DD`), as ADR 0002, Amendment 1, "How the wizard uses it" describes. The answers have passed
 * the setup schema. `storedWeightUnit` is the profile's stored unit, null on a first set up: the chosen
 * unit is saved only then. The weight entered is the trend weight, because there is no trend yet.
 *
 * Throws a `RangeError` when a person under 18 chose `lose`. The screens never offer it, so this is a
 * backstop, and the message states the rule and holds no health value.
 */
export function startingPlan(
  answers: SetupAnswers,
  today: string,
  storedWeightUnit: WeightUnit | null,
  params: EngineParams = DEFAULT_ENGINE_PARAMS,
): StartingPlan {
  const ageYears = ageInYears(answers.birthDate, today);
  if (!goalsAllowed(ageYears).includes(answers.goal)) {
    throw new RangeError("A lose goal is not allowed under 18.");
  }

  const { bmrKcal, muKcal } = initialExpenditure(
    {
      sex: answers.sex,
      ageYears,
      heightCm: answers.heightCm,
      weightKg: answers.weightKg,
      activity: answers.activity,
    },
    params,
  );
  const proteinGPerKg = params.targets.proteinPresets[answers.proteinPreset];
  const fatFraction = params.targets.fatFractions[answers.dietStyle];

  const derived = deriveTargets(
    {
      config: {
        goal: answers.goal,
        ratePctPerWeek: answers.ratePctPerWeek,
        proteinGPerKg,
        fatFraction,
      },
      tdee: muKcal,
      trendWeight: answers.weightKg,
      bmr: bmrKcal,
    },
    params,
  );
  const capped = capToProfileRange(
    derived.caloriesKcal,
    derived.clamps.filter((clamp) => clamp !== "macro_fit"),
  );
  const capApplied = capped.caloriesKcal !== derived.caloriesKcal;
  // Macros for the calories before the cap would not fit the stored calories, so they are split again.
  const macros = capApplied
    ? splitMacros(
        {
          caloriesKcal: capped.caloriesKcal,
          trendWeight: answers.weightKg,
          proteinGPerKg,
          fatFraction,
        },
        params,
      )
    : derived;
  const clamps = capApplied ? [...capped.clamps, ...macros.clamps] : derived.clamps;
  const weightUnit = weightUnitToSave(storedWeightUnit, answers.weightUnit);

  return {
    estimate: { bmrKcal, expenditureKcal: muKcal },
    targets: {
      caloriesKcal: capped.caloriesKcal,
      proteinG: macros.proteinG,
      fatG: macros.fatG,
      carbsG: macros.carbsG,
    },
    clamps,
    // The cap moves the calories, so the rate is restated for the calories that are stored.
    effectiveRatePctPerWeek: capApplied
      ? effectiveRatePctPerWeek(
          {
            goal: answers.goal,
            caloriesKcal: capped.caloriesKcal,
            tdee: muKcal,
            trendWeight: answers.weightKg,
          },
          params,
        )
      : derived.effectiveRatePctPerWeek,
    save: {
      profile: {
        sex: answers.sex,
        birth_date: answers.birthDate,
        height_cm: answers.heightCm,
        activity: answers.activity,
        onboarding_weight_kg: answers.weightKg,
        target_kcal: capped.caloriesKcal,
        target_protein_g: macros.proteinG,
        target_carbs_g: macros.carbsG,
        target_fat_g: macros.fatG,
        ...(weightUnit === undefined ? {} : { weight_unit: weightUnit }),
      },
      program: {
        goal: answers.goal,
        rate_pct_per_week: answers.ratePctPerWeek,
        protein_g_per_kg: proteinGPerKg,
        fat_fraction_of_remaining: fatFraction,
        split_preset: answers.dietStyle,
        started_on: today,
      },
      weighIn: { weightKg: answers.weightKg, localDate: today },
    },
  };
}
