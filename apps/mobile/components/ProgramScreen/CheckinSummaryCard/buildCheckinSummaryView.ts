import {
  PROGRAM_CHECKIN_SUMMARY,
  describeCarriedForwardLine,
  describeCheckinDataLine,
  describeCheckinSummaryName,
  describeDateInWords,
  describeKcalChange,
  describeNotMeasuredReasons,
  guardrailLineOrder,
} from "@keylow/core/copy";
import { DEFAULT_ENGINE_PARAMS, calorieFloorKcal } from "@keylow/core/engine";
import { checkinSummary, expenditureBand } from "@keylow/core/program";

import type {
  CheckinSnapshot,
  CheckinSummaryView,
  CheckinTargetsRows,
  SummaryLineView,
  SummaryRowView,
} from "./types";
import type { ExpenditureSnapshot } from "@keylow/api-client";
import type { ProgramGuardrailEntry } from "@keylow/core/copy";
import type { CheckinSummary } from "@keylow/core/program";
import type { SetupClamp } from "@keylow/core/setup";
import type { WeightDisplayUnit } from "@keylow/core/weight";

type BuildInput = CheckinTargetsRows & {
  snapshot: CheckinSnapshot;
  previousSnapshot: ExpenditureSnapshot | null;
  unit: WeightDisplayUnit;
};

const row = (label: string, value: string): SummaryRowView => ({
  label,
  value,
  name: `${label}: ${value}`,
});

// The guardrails that applied, with the figures each line states. The step clamp is not a clamp code of the
// targets, so it comes from the summary's own flag. A clamp with no line for this goal gives none.
function guardrailEntries(
  summary: CheckinSummary,
  { targets, snapshot, unit }: BuildInput,
): ProgramGuardrailEntry[] {
  const { basis } = targets;
  const rate = {
    weightKg: basis.trendWeightKg,
    effectiveRatePctPerWeek: summary.effectiveRatePctPerWeek,
    wantedRatePctPerWeek: basis.ratePctPerWeek,
    unit,
  };
  const calories = { ...rate, caloriesKcal: targets.caloriesKcal };
  const clampEntry = (code: SetupClamp): ProgramGuardrailEntry[] => {
    switch (code) {
      case "max_rate":
        return basis.goal === "maintain" ? [] : [{ code, figures: { goal: basis.goal } }];
      case "max_deficit":
      case "max_surplus":
        return [{ code, figures: rate }];
      case "floor":
        return [{ code, figures: { ...calories, expenditureKcal: snapshot.muKcal } }];
      case "profile_max":
        return [{ code, figures: calories }];
      case "macro_fit":
        return [
          {
            code,
            figures: {
              proteinGrams: targets.proteinG,
              caloriesKcal: targets.caloriesKcal,
              fatGrams: targets.fatG,
            },
          },
        ];
      case "dow_floor":
        return [
          { code, figures: { floorKcal: calorieFloorKcal(basis.bmrKcal, DEFAULT_ENGINE_PARAMS) } },
        ];
      case "dow_range":
        return [{ code, figures: undefined }];
    }
  };

  return [
    ...(summary.expenditureStepClamped
      ? [
          {
            code: "expenditure_step",
            figures: { rawChangeKcal: summary.expenditureRawChangeKcal },
          } satisfies ProgramGuardrailEntry,
        ]
      : []),
    ...summary.clamps.flatMap(clampEntry),
  ];
}

function measuredLines(summary: CheckinSummary, input: BuildInput): SummaryLineView[] {
  return [
    { kind: "data", text: describeCheckinDataLine(summary.counts) },
    ...guardrailLineOrder(guardrailEntries(summary, input)).flatMap(
      ({ text, followUp }): SummaryLineView[] => [
        { kind: "guardrail", text },
        ...(followUp === null ? [] : [{ kind: "plain" as const, text: followUp }]),
      ],
    ),
  ];
}

function notMeasuredLines(summary: CheckinSummary, snapshot: CheckinSnapshot): SummaryLineView[] {
  return [
    ...describeNotMeasuredReasons(summary.reasons, summary.counts).map((text): SummaryLineView => ({
      kind: "reason",
      text,
    })),
    { kind: "plain", text: describeCarriedForwardLine(expenditureBand(snapshot)) },
  ];
}

/**
 * Everything the check-in summary card writes, from the check-in's snapshot, the one before it, its own targets
 * row and the row before that. The numbers and the reasons are core's (`checkinSummary`, `expenditureBand`), the
 * words are core's copy, and the lines come in `guardrailLineOrder`. Null when the card has nothing true to say:
 * a measured check-in needs the estimate before it to say where the expenditure moved from.
 */
export function buildCheckinSummaryView(input: BuildInput): CheckinSummaryView | null {
  const { snapshot, previousSnapshot, targets, previousTargets } = input;
  const summary = checkinSummary(previousTargets, targets, snapshot);
  const isMeasured = summary.kind === "measured";
  if (!isMeasured && summary.kind !== "not_measured") {
    return null;
  }

  const expenditure = isMeasured
    ? previousSnapshot === null
      ? null
      : describeKcalChange(previousSnapshot.muKcal, snapshot.muKcal)
    : describeKcalChange(snapshot.muKcal, snapshot.muKcal, { carriedForward: true });
  if (expenditure === null) {
    return null;
  }

  return {
    name: describeCheckinSummaryName(snapshot.asOfDate, isMeasured),
    dateText: describeDateInWords(snapshot.asOfDate),
    isMeasured,
    rows: [
      row(PROGRAM_CHECKIN_SUMMARY.expenditureLabel, expenditure),
      row(
        PROGRAM_CHECKIN_SUMMARY.calorieTargetLabel,
        describeKcalChange(previousTargets.caloriesKcal, targets.caloriesKcal),
      ),
    ],
    lines: isMeasured ? measuredLines(summary, input) : notMeasuredLines(summary, snapshot),
  };
}
