import * as copy from "../../../src/copy";

// Every function `src/copy/program.ts` exports, called with representative arguments. The voice test fails when
// a function has no row, so no sentence escapes the sweep.
const settlingBand = { muKcal: 2413.125, lowKcal: 1950, highKcal: 2880 };
const goldenBand = { muKcal: 2579.54, lowKcal: 2430, highKcal: 2730 };
const counts = { spanDays: 9, weighDays: 5, completeDays: 9 };

export const samples: Record<string, () => string[]> = {
  describeCountOfTarget: () => [
    copy.describeCountOfTarget(4, 8),
    copy.describeCountOfTarget(0, 10),
  ],
  describeCountedName: () => [
    copy.describeCountedName("Days with a weigh-in", 4, 8),
    copy.describeCountedName("Complete days", 10, 10),
  ],
  describeLikelyRange: () => [copy.describeLikelyRange(goldenBand)],
  describeExpenditureHeroName: () => [
    copy.describeExpenditureHeroName(goldenBand),
    copy.describeExpenditureHeroName(settlingBand),
  ],
  describeExpenditureSource: () => [copy.describeExpenditureSource("2026-10-23")],
  describeTargetsCardSince: () => [copy.describeTargetsCardSince("2026-10-23")],
  describeTargetsCardName: () => [copy.describeTargetsCardName(2140)],
  describeNextCheckInCaption: () => [
    copy.describeNextCheckInCaption(7, "2026-10-30"),
    copy.describeNextCheckInCaption(1, "2026-10-30"),
    copy.describeNextCheckInCaption(0, "2026-10-30"),
  ],
  describeNextCheckInSubtitle: () => [copy.describeNextCheckInSubtitle("2026-10-30")],
  describeFirstCheckInBanner: () => [
    copy.describeFirstCheckInBanner("2026-11-06", 9),
    copy.describeFirstCheckInBanner("2026-11-06", 1),
    copy.describeFirstCheckInBanner("2026-11-06", 0),
  ],
  describeSettlingTip: () => [copy.describeSettlingTip("2026-11-06")],
  describeSettlingTipOnOrAfter: () => [copy.describeSettlingTipOnOrAfter("2026-11-02")],
  describeSettlingTipFor: () => [
    copy.describeSettlingTipFor("2026-11-06", "2026-11-05") ?? "",
    copy.describeSettlingTipFor("2026-11-06", "2026-11-02") ?? "",
  ],
  describeOwnTargetsStay: () => [copy.describeOwnTargetsStay(2200)],
  describeRateSubtitle: () => [
    copy.describeRateSubtitle(0.5, 79.023, "kg"),
    copy.describeRateSubtitle(0.5, 79.023, "lb"),
  ],
  describeProteinSubtitle: () => [
    copy.describeProteinSubtitle("moderate", 79.023),
    copy.describeProteinSubtitle("very_high", 79.023),
  ],
  describeCheckinSummaryName: () => [
    copy.describeCheckinSummaryName("2026-10-09", true),
    copy.describeCheckinSummaryName("2026-10-09", false),
  ],
  describeKcalChange: () => [
    copy.describeKcalChange(2574.22, 2579.54),
    copy.describeKcalChange(2140, 2140),
    copy.describeKcalChange(2500, 2500, { carriedForward: true }),
  ],
  describeCheckinDataLine: () => [
    copy.describeCheckinDataLine({ weighDays: 28, completeDays: 28 }),
  ],
  describeNotMeasuredReasons: () => [
    ...copy.describeNotMeasuredReasons(["span", "weigh_days", "complete_days"], counts),
  ],
  describeCarriedForwardLine: () => [
    copy.describeCarriedForwardLine({ lowKcal: 2010, highKcal: 2990 }),
  ],
  guardrailLineOrder: () =>
    copy
      .guardrailLineOrder([
        { code: "expenditure_step", figures: { rawChangeKcal: -414.8 } },
        { code: "expenditure_step", figures: { rawChangeKcal: 283.7 } },
        { code: "max_rate", figures: { goal: "gain" } },
        {
          code: "floor",
          figures: {
            caloriesKcal: 1200,
            expenditureKcal: 1093.6,
            weightKg: 39.9,
            effectiveRatePctPerWeek: -0.2431,
            wantedRatePctPerWeek: 0.5,
            unit: "kg",
          },
        },
        { code: "dow_floor", figures: { floorKcal: 1579.5 } },
        { code: "dow_range", figures: undefined },
        { code: "macro_fit", figures: { proteinGrams: 120, caloriesKcal: 1200, fatGrams: 80 } },
      ])
      .flatMap((line) => (line.followUp === null ? [line.text] : [line.text, line.followUp])),
  describeExplainerSections: () =>
    copy
      .describeExplainerSections("2026-10-30")
      .flatMap((section) => [section.title, section.text]),
  describeExpenditureChartSummary: () => [
    copy.describeExpenditureChartSummary({
      weekCount: 5,
      firstWeekStart: "2026-09-21",
      firstMuKcal: 2500,
      latest: goldenBand,
      isSettling: false,
    }),
    copy.describeExpenditureChartSummary({
      weekCount: 2,
      firstWeekStart: "2026-10-19",
      firstMuKcal: 2413.125,
      latest: settlingBand,
      isSettling: true,
    }),
    copy.describeExpenditureChartSummary({
      weekCount: 1,
      firstWeekStart: "2026-10-19",
      firstMuKcal: 2413.125,
      latest: settlingBand,
      isSettling: true,
    }),
  ],
  describeEditFootnote: () => [copy.describeEditFootnote(2579.54)],
  describeTargetsScreenSince: () => [copy.describeTargetsScreenSince("2026-10-23")],
  describeMeasuredAccuracyLine: () => [copy.describeMeasuredAccuracyLine("2026-10-23")],
};
