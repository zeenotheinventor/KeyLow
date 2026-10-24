import * as copy from "../../../src/copy";

// Every function `src/copy/setup.ts` exports, called with representative arguments. The voice test fails when
// a function has no row, so no sentence escapes the sweep. A field that says nothing gives null, which is left out.
const sentencesOf = (...texts: Array<string | null>): string[] =>
  texts.flatMap((text) => (text === null ? [] : [text]));

const [loseRate] = copy.SETUP_RATE_OPTIONS.lose;
const [gainRate] = copy.SETUP_RATE_OPTIONS.gain;

export const samples: Record<string, () => string[]> = {
  describeSetupStepLabel: () => [
    copy.describeSetupStepLabel(3, 8),
    copy.describeSetupStepLabel(5, 7),
  ],
  describeSetupOptionName: () => [
    copy.describeSetupOptionName("Female"),
    copy.describeSetupOptionName("Lose weight", copy.SETUP_GOAL_NOT_OFFERED_UNDER_18),
    copy.describeSetupOptionName("Prefer not to say", copy.SETUP_SEX_OPTIONS.other.description),
  ],
  describeRateTitle: () => [copy.describeRateTitle(0.5), copy.describeRateTitle(1.0)],
  describeRateAmount: () => [
    copy.describeRateAmount(0.5, 80, "kg"),
    copy.describeRateAmount(0.5, 80, "lb"),
  ],
  describeRateAmountInWords: () => [
    copy.describeRateAmountInWords(0.5, 80, "kg"),
    copy.describeRateAmountInWords(0.5, 80, "lb"),
  ],
  describeRateOptionName: () =>
    [loseRate, gainRate].flatMap((option) =>
      option === undefined
        ? []
        : [
            copy.describeRateOptionName(option, 80, "kg"),
            copy.describeRateOptionName(option, 80, "lb"),
          ],
    ),
  describeProteinGrams: () => [
    copy.describeProteinGrams("moderate", 80),
    copy.describeProteinGrams("very_high", 80),
  ],
  describeAgeLine: () => [copy.describeAgeLine(35)],
  describeWeighInSource: () => [
    copy.describeWeighInSource("2026-10-21", "2026-10-23"),
    copy.describeWeighInSource("2026-10-23", "2026-10-23"),
  ],
  describeBirthDateProblem: () => [
    copy.describeBirthDateProblem("not-a-date", "2026-10-23"),
    copy.describeBirthDateProblem("future", "2026-10-23"),
    copy.describeBirthDateProblem("too-young", "2026-10-23"),
    copy.describeBirthDateProblem("too-old", "2026-10-23"),
  ],
  describeHeightProblem: () =>
    (
      [
        "empty",
        "not-a-number",
        "too-low",
        "too-high",
        "too-many-decimals",
        "inches-out-of-range",
      ] as const
    ).flatMap((reason) =>
      sentencesOf(
        copy.describeHeightProblem(reason, "cm"),
        copy.describeHeightProblem(reason, "ft_in"),
      ),
    ),
  describeSetupWeightProblem: () =>
    (["empty", "not-a-number", "too-low", "too-high", "too-many-decimals"] as const).flatMap(
      (reason) =>
        sentencesOf(
          copy.describeSetupWeightProblem(reason, "kg"),
          copy.describeSetupWeightProblem(reason, "lb"),
        ),
    ),
  describeRateLine: () =>
    (["lose", "maintain", "gain"] as const).map((goal) =>
      copy.describeRateLine({ goal, ratePctPerWeek: 0.5, weightKg: 80, unit: "kg" }),
    ),
};
