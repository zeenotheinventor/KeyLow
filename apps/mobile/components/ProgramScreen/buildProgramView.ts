import {
  PROGRAM_GUARDRAIL_LINES,
  PROGRAM_SCREEN,
  SETUP_DIET_OPTIONS,
  SETUP_GOAL_OPTIONS,
  SETUP_PROTEIN_OPTIONS,
  describeExpenditureHeroName,
  describeExpenditureSource,
  describeLikelyRange,
  describeNextCheckInCaption,
  describeProteinSubtitle,
  describeRateLine,
  describeRateSubtitle,
  describeRateTitle,
  describeShortDate,
  describeTargetsCardName,
  describeTargetsCardSince,
} from "@keylow/core/copy";
import { formatCalories } from "@keylow/core/format";
import { expenditureBand, settlingProgress } from "@keylow/core/program";
import {
  DIET_STYLES,
  GOALS,
  PROTEIN_G_PER_KG,
  PROTEIN_PRESETS,
  bindingCalorieClamp,
} from "@keylow/core/setup";

import type {
  BuildProgramViewInput,
  CheckInRowView,
  ExpenditureHeroView,
  MacroTilesView,
  ProgramDetailRow,
  ProgramView,
  WeekTargetsView,
} from "./types";
import type { TargetsRow, Targets } from "@keylow/api-client";
import type { CalorieClampCode } from "@keylow/core/setup";
import type { WeightDisplayUnit } from "@keylow/core/weight";

// Settling reads the schedule alone when it is given no snapshots, so this is the days from today to a date,
// from today on, which is what "In 7 days" says. Core keeps the rule in one place.
function daysUntil(checkInDate: string, today: string): number {
  return settlingProgress({ nextCheckinDate: checkInDate }, [], today).daysLeft ?? 0;
}

type GuardrailInput = {
  code: CalorieClampCode;
  weightKg: number;
  effectiveRatePctPerWeek: number;
  wantedRatePctPerWeek: number;
  unit: WeightDisplayUnit;
  caloriesKcal: number;
  expenditureKcal: number;
};

function guardrailLine({ code, expenditureKcal, ...figures }: GuardrailInput): string {
  switch (code) {
    case "max_deficit":
      return PROGRAM_GUARDRAIL_LINES.max_deficit(figures);
    case "max_surplus":
      return PROGRAM_GUARDRAIL_LINES.max_surplus(figures);
    case "floor":
      return PROGRAM_GUARDRAIL_LINES.floor({ ...figures, expenditureKcal });
    case "profile_max":
      return PROGRAM_GUARDRAIL_LINES.profile_max(figures);
  }
}

function checkInRowOf(
  nextCheckinDate: string | null,
  isSettling: boolean,
  today: string,
): CheckInRowView | null {
  if (nextCheckinDate === null) {
    return null;
  }
  return {
    title: isSettling ? PROGRAM_SCREEN.targets.firstCheckIn : PROGRAM_SCREEN.targets.nextCheckIn,
    caption: describeNextCheckInCaption(daysUntil(nextCheckinDate, today), nextCheckinDate),
    dateText: describeShortDate(nextCheckinDate),
  };
}

function macrosOf(targetsRead: Targets, row: TargetsRow | null): MacroTilesView | null {
  if (row !== null) {
    return { proteinG: row.proteinG, carbsG: row.carbsG, fatG: row.fatG };
  }
  const { protein_g, carbs_g, fat_g } = targetsRead;
  return protein_g === null || carbs_g === null || fat_g === null
    ? null
    : { proteinG: protein_g, carbsG: carbs_g, fatG: fat_g };
}

/**
 * Everything the Programme screen writes, from what it read. The estimate is the newest snapshot's, or the
 * starting estimate when the program has none yet. It is settling by core's rule: the newest snapshot is the
 * start snapshot, or there is no snapshot. The targets are the program's current row, or, before it has one,
 * what the targets read holds. Null when there is no estimate to show. Every word is core's copy.
 */
export function buildProgramView({
  program,
  latestSnapshot,
  previousSnapshot,
  currentTargets,
  targetsRead,
  startBelief,
  fallbackWeightKg,
  unit,
  today,
}: BuildProgramViewInput): ProgramView | null {
  const belief = latestSnapshot ?? startBelief;
  if (belief === null) {
    return null;
  }
  const snapshots = [latestSnapshot, previousSnapshot].filter((snapshot) => snapshot !== null);
  const { settling } = settlingProgress(program, snapshots, today);
  const band = expenditureBand(belief);
  const weightKg = currentTargets?.basis.trendWeightKg ?? fallbackWeightKg;
  const goal = GOALS.find((candidate) => candidate === program.goal);

  const hero: ExpenditureHeroView = {
    name: describeExpenditureHeroName(band),
    kcalText: formatCalories(band.muKcal),
    rangeText: describeLikelyRange(band),
    captionText:
      settling || latestSnapshot === null
        ? PROGRAM_SCREEN.hero.settlingLine
        : describeExpenditureSource(latestSnapshot.asOfDate),
    isSettling: settling,
  };

  const caloriesKcal = currentTargets?.caloriesKcal ?? targetsRead.kcal;
  const clamp =
    currentTargets === null ? undefined : bindingCalorieClamp(currentTargets.basis.clamps);
  const targets: WeekTargetsView | null =
    caloriesKcal === null
      ? null
      : {
          name: describeTargetsCardName(caloriesKcal),
          kcalText: formatCalories(caloriesKcal),
          sinceText: describeTargetsCardSince(currentTargets?.effectiveFrom ?? program.startedOn),
          isGuardrail: clamp !== undefined && currentTargets !== null,
          line:
            weightKg === null || goal === undefined
              ? null
              : clamp !== undefined && currentTargets !== null
                ? guardrailLine({
                    code: clamp,
                    weightKg,
                    effectiveRatePctPerWeek: currentTargets.basis.effectiveRatePctPerWeek,
                    wantedRatePctPerWeek: currentTargets.basis.ratePctPerWeek,
                    unit,
                    caloriesKcal,
                    expenditureKcal: band.muKcal,
                  })
                : describeRateLine({
                    goal,
                    ratePctPerWeek: program.ratePctPerWeek,
                    weightKg,
                    unit,
                  }),
          macros: macrosOf(targetsRead, currentTargets),
          checkIn: checkInRowOf(program.nextCheckinDate, settling, today),
        };

  return { hero, targets, details: detailsOf(program, weightKg, unit) };
}

function detailsOf(
  program: BuildProgramViewInput["program"],
  weightKg: number | null,
  unit: WeightDisplayUnit,
): readonly ProgramDetailRow[] {
  const { details } = PROGRAM_SCREEN;
  const goal = GOALS.find((candidate) => candidate === program.goal);
  const proteinPreset = PROTEIN_PRESETS.find(
    (preset) => PROTEIN_G_PER_KG[preset] === program.proteinGPerKg,
  );
  const dietStyle = DIET_STYLES.find((style) => style === program.splitPreset);

  const rows: (ProgramDetailRow | null)[] = [
    goal === undefined
      ? null
      : {
          key: "goal",
          title: details.goal,
          subtitle: undefined,
          value: SETUP_GOAL_OPTIONS[goal].title,
        },
    goal === undefined || goal === "maintain"
      ? null
      : {
          key: "rate",
          title: details.rate,
          subtitle:
            weightKg === null
              ? undefined
              : describeRateSubtitle(program.ratePctPerWeek, weightKg, unit),
          value: describeRateTitle(program.ratePctPerWeek),
        },
    proteinPreset === undefined
      ? null
      : {
          key: "protein",
          title: details.protein,
          subtitle:
            weightKg === null ? undefined : describeProteinSubtitle(proteinPreset, weightKg),
          value: SETUP_PROTEIN_OPTIONS[proteinPreset].title,
        },
    dietStyle === undefined
      ? null
      : {
          key: "diet",
          title: details.dietStyle,
          subtitle: undefined,
          value: SETUP_DIET_OPTIONS[dietStyle].title,
        },
  ];
  return rows.filter((row) => row !== null);
}
