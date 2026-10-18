// The default mapping from free-exercise-db's coarse muscle groups onto the 22 muscle ids, and the
// default exclusions. MAPPING.md is the written form of this file; a change here is a change there.
// Movement patterns are read from the exercise name, lower-cased, because the source has nothing finer.
import { DEFAULT_WEIGHTS } from "./muscles";

import type { Equipment } from "./columns";
import type { MuscleId, Role } from "./muscles";
import type { MuscleShare } from "./muscleShares";
import type { SourceExercise, SourceMuscleGroup } from "./sourceExercise";

// Exclusion

const EXCLUDED_CATEGORIES: Readonly<Record<string, string>> = {
  stretching: "stretch",
  cardio: "cardio",
  plyometrics: "plyometric drill",
};

/** The reason the rules leave an exercise out, or undefined when they keep it. Duplicates are found later. */
export const categoryExclusion = (exercise: SourceExercise): string | undefined =>
  EXCLUDED_CATEGORIES[exercise.category];

// Movement patterns

/** Rear-delt work: reverse flyes, face pulls, band pull-aparts, bent-over laterals, external rotation. */
const rearDelt =
  /rear|reverse fly|reverse flye|reverse machine fly|face pull|pull apart|back fly|external rotation|bent over low-pulley side lateral|row to neck/;
/** Side-delt work: lateral raises, upright rows and high pulls. Checked after rearDelt. */
const sideDelt = /lateral|upright|high pull|crucifix/;
/** Overhead pressing, where the side delt helps the front delt. */
const overheadPress =
  /press|jerk|handstand|thruster|get-up|jammer|log lift|circus bell|clean and|bradford/;
/** Rowing, where the lats and the mid traps are both prime movers. Upright and rear-delt rows are not rows here. */
const row = /\brows?\b|t-bar|bench pull/;
/** Vertical and horizontal pulls, where the shoulders listed as secondary are the rear delts. */
const pull =
  /\brows?\b|t-bar|bench pull|pulldown|pull-?ups?|pullups|\bchin|rope climb|muscle up|london bridge/;
/** Upper chest: incline pressing and flyes (not hands-elevated push-ups), feet-elevated push-ups, low-to-high crossovers, presses to the neck. */
const upperChest =
  /incline(?! push-?up)|decline push-?up|feet elevated|low cable crossover|guillotine|neck press/;
/** Lower chest: decline pressing, dips and hands-elevated ("incline") push-ups. */
const lowerChest = /decline|dip|incline push-?up/;
/** Rotation, anti-rotation and side bending, where the abdominals listed are the obliques. */
const oblique =
  /oblique|twist|side bend|russian|wood chop|windmill|side bridge|side plank|judo flip|landmine 180|cable lift|pallof|heel touch|cross-body crunch|elbow to knee|side jackknife|figure 8|pirate ship|spell caster|bent press/;
/** Hip abduction, where the glutes listed are the glute medius. */
const abduction = /abduct|monster walk|side leg raise|lateral band walk|clam|fire hydrant/;
/** Dorsiflexion (tibialis raises). The only exercises that put tibialis on the map. */
const dorsiflexion = /reverse calf raise|tibialis raise|toe raise|dorsiflex/;
/** Hinges and loaded carries from the floor, where the lower back works hard rather than only bracing. */
const hinge =
  /deadlift|good morning|romanian|stiff-legged|rack pull|hyperextension|back extension|pull through|swing|clean|snatch|atlas|keg|sandbag|tire flip|windmill|bent press|glute ham|figure 8|pass between|landmine 180/;
/** Neutral and overhand curls, which load the brachioradialis (forearms) even where the source lists none. */
const forearmCurl = /hammer|reverse.*curl|zottman/;
/** Triple extension, where the calves listed drive the movement rather than steady it. */
const tripleExtension = /clean|snatch|jerk|push press|jump|thruster|high pull|swing/;

interface Patterns {
  rearDelt: boolean;
  sideDelt: boolean;
  overheadPress: boolean;
  row: boolean;
  pull: boolean;
  chest: "upper" | "lower" | "flat";
  oblique: boolean;
  abduction: boolean;
  dorsiflexion: boolean;
  hinge: boolean;
  tripleExtension: boolean;
  armIsolation: boolean;
  shoulderPrimary: boolean;
  forearmCurl: boolean;
}

function readPatterns(exercise: SourceExercise): Patterns {
  const name = exercise.name.toLowerCase();
  const isRearDelt = rearDelt.test(name);
  const isSideDelt = !isRearDelt && sideDelt.test(name);
  const isWholeBodyLift =
    exercise.category === "olympic weightlifting" || exercise.category === "strongman";
  return {
    rearDelt: isRearDelt,
    sideDelt: isSideDelt,
    overheadPress: !isRearDelt && !isSideDelt && overheadPress.test(name),
    row: !isRearDelt && !isSideDelt && row.test(name),
    pull: !isRearDelt && !isSideDelt && pull.test(name),
    chest: upperChest.test(name) ? "upper" : lowerChest.test(name) ? "lower" : "flat",
    oblique: oblique.test(name),
    abduction: abduction.test(name),
    dorsiflexion: dorsiflexion.test(name),
    hinge: isWholeBodyLift || hinge.test(name),
    tripleExtension: exercise.category === "olympic weightlifting" || tripleExtension.test(name),
    armIsolation: exercise.primaryMuscles.some(
      (group) => group === "biceps" || group === "triceps" || group === "forearms",
    ),
    shoulderPrimary: exercise.primaryMuscles.includes("shoulders"),
    forearmCurl: exercise.primaryMuscles.includes("biceps") && forearmCurl.test(name),
  };
}

// Mapping

const share = (muscle: MuscleId, role: Role, weight = DEFAULT_WEIGHTS[role]): MuscleShare => ({
  muscle,
  role,
  weight,
});

/** Weights the chest rules use instead of the default secondary 0.5 (MAPPING.md, "Chest"). */
const FLAT_PRESS_UPPER_CHEST = 0.6;
const DECLINE_UPPER_CHEST = 0.3;

const DIRECT_GROUPS: Partial<Record<SourceMuscleGroup, MuscleId>> = {
  biceps: "biceps",
  triceps: "triceps",
  forearms: "forearms",
  quadriceps: "quads",
  hamstrings: "hamstrings",
  adductors: "adductors",
  neck: "neck",
  lats: "lats",
  "middle back": "traps_mid",
  traps: "traps_upper",
  "lower back": "lower_back",
  abductors: "glute_med",
};

function mapPrimary(group: SourceMuscleGroup, patterns: Patterns): MuscleShare[] {
  switch (group) {
    case "chest":
      if (patterns.chest === "upper") {
        return [share("chest_upper", "primary"), share("chest_lower", "secondary")];
      }
      return [
        share("chest_lower", "primary"),
        share(
          "chest_upper",
          "secondary",
          patterns.chest === "lower" ? DECLINE_UPPER_CHEST : FLAT_PRESS_UPPER_CHEST,
        ),
      ];
    case "shoulders":
      if (patterns.rearDelt) {
        return [share("delt_rear", "primary")];
      }
      if (patterns.sideDelt) {
        return [share("delt_side", "primary")];
      }
      if (patterns.overheadPress) {
        return [share("delt_front", "primary"), share("delt_side", "secondary")];
      }
      return [share("delt_front", "primary")];
    case "traps":
      // Upright rows and high pulls are side-delt work whichever group the source lists first.
      return patterns.sideDelt
        ? [share("delt_side", "primary"), share("traps_upper", "secondary")]
        : [share("traps_upper", "primary")];
    case "lats":
    case "middle back":
      return patterns.row
        ? [share("lats", "primary"), share("traps_mid", "primary")]
        : [share(group === "lats" ? "lats" : "traps_mid", "primary")];
    case "glutes":
      return [share(patterns.abduction ? "glute_med" : "glute_max", "primary")];
    case "abdominals":
      return patterns.oblique
        ? [share("obliques", "primary"), share("abs", "secondary")]
        : [share("abs", "primary")];
    case "calves":
      return [share(patterns.dorsiflexion ? "tibialis" : "calves", "primary")];
    default: {
      const muscle = DIRECT_GROUPS[group];
      if (muscle === undefined) {
        throw new Error(`No primary rule for ${group}`);
      }
      return [share(muscle, "primary")];
    }
  }
}

function mapSecondary(group: SourceMuscleGroup, patterns: Patterns): MuscleShare[] {
  switch (group) {
    case "chest":
      return [
        share(
          patterns.shoulderPrimary || patterns.chest === "upper" ? "chest_upper" : "chest_lower",
          "secondary",
        ),
      ];
    case "shoulders":
      if (patterns.sideDelt) {
        return [share("delt_side", "secondary")];
      }
      return [share(patterns.rearDelt || patterns.pull ? "delt_rear" : "delt_front", "secondary")];
    case "glutes":
      return [share(patterns.abduction ? "glute_med" : "glute_max", "secondary")];
    case "abdominals":
      return patterns.oblique
        ? [share("obliques", "secondary"), share("abs", "stabiliser")]
        : [share("abs", "stabiliser")];
    case "calves":
      return [share("calves", patterns.tripleExtension ? "secondary" : "stabiliser")];
    case "lower back":
      return [share("lower_back", patterns.hinge ? "secondary" : "stabiliser")];
    case "forearms":
      return [share("forearms", patterns.armIsolation ? "secondary" : "stabiliser")];
    default: {
      const muscle = DIRECT_GROUPS[group];
      if (muscle === undefined) {
        throw new Error(`No secondary rule for ${group}`);
      }
      return [share(muscle, "secondary")];
    }
  }
}

const roleRank: Readonly<Record<Role, number>> = { primary: 0, secondary: 1, stabiliser: 2 };

/** One share per muscle: the strongest role wins, and within a role the larger weight. */
export function mergeShares(shares: readonly MuscleShare[]): MuscleShare[] {
  const byMuscle = new Map<MuscleId, MuscleShare>();
  for (const candidate of shares) {
    const current = byMuscle.get(candidate.muscle);
    if (
      current === undefined ||
      roleRank[candidate.role] < roleRank[current.role] ||
      (candidate.role === current.role && candidate.weight > current.weight)
    ) {
      byMuscle.set(candidate.muscle, candidate);
    }
  }
  return [...byMuscle.values()];
}

/** The rule-based muscle map of one source exercise, before any hand override. */
export function mapExerciseMuscles(exercise: SourceExercise): MuscleShare[] {
  const patterns = readPatterns(exercise);
  return mergeShares([
    ...exercise.primaryMuscles.flatMap((group) => mapPrimary(group, patterns)),
    ...exercise.secondaryMuscles.flatMap((group) => mapSecondary(group, patterns)),
    ...(patterns.forearmCurl ? [share("forearms", "secondary")] : []),
  ]);
}

/** The source's mechanic, or, where it has none, compound when it lists secondary muscles. */
export const mapMechanic = (exercise: SourceExercise): "compound" | "isolation" =>
  exercise.mechanic === "compound" || exercise.mechanic === "isolation"
    ? exercise.mechanic
    : exercise.secondaryMuscles.length > 0
      ? "compound"
      : "isolation";

const sourceEquipment: Record<string, Equipment> = {
  barbell: "barbell",
  dumbbell: "dumbbell",
  kettlebells: "kettlebell",
  cable: "cable",
  machine: "machine",
  "e-z curl bar": "ez_bar",
  bands: "band",
  "body only": "bodyweight",
  "exercise ball": "other",
  "medicine ball": "other",
  "foam roll": "other",
  other: "other",
};

/**
 * The source's equipment as the enum: a Smith machine by name (the source files it under machine
 * or barbell), and a missing value as bodyweight, which every kept exercise without one is.
 */
export const mapEquipment = (exercise: SourceExercise): Equipment => {
  if (/\bsmith\b/i.test(exercise.name)) {
    return "smith_machine";
  }
  if (exercise.equipment === null) {
    return "bodyweight";
  }
  const mapped = sourceEquipment[exercise.equipment];
  if (mapped === undefined) {
    throw new Error(`${exercise.id}: equipment has no mapping to the enum`);
  }
  return mapped;
};
