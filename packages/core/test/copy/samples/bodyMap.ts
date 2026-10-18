import * as copy from "../../../src/copy";

// Every function `src/copy/bodyMap.ts` exports, called with representative arguments. The voice test fails
// when a function has no row, so no sentence escapes the sweep.
const THURSDAY = "2026-10-15T19:00:00+01:00";
const SUNDAY = "2026-10-18T20:00:00+01:00";
const LONDON = "Europe/London";
const SATURDAYS_PUSH = { localDate: "2026-10-17", routineDayName: "Push" };
const FRIDAYS_PULL = { localDate: "2026-10-16", routineDayName: "Pull" };
const warmest = [
  { muscle: "lats", percent: 25 },
  { muscle: "traps_mid", percent: 18 },
  { muscle: "biceps", percent: 15 },
] as const;
const dashboardInputs: copy.DashboardBodyMapCardInput[] = [
  {
    warmest,
    today: { kind: "session", routineDayName: "Legs", plannedSets: 16 },
    heatWindowDays: 14,
    opensBodyMap: true,
  },
  { warmest, today: { kind: "rest" }, heatWindowDays: 14, opensBodyMap: true },
  { warmest: [], today: null, heatWindowDays: 14, opensBodyMap: true },
  { warmest, today: { kind: "rest" }, heatWindowDays: 14, opensBodyMap: false },
];
const header = { tz: LONDON, weekEnd: "2026-10-18", plannedSessions: [SATURDAYS_PUSH] } as const;

export const samples: Record<string, () => string[]> = {
  formatSetCount: () => [copy.formatSetCount(11), copy.formatSetCount(5.5)],
  describeSets: () => [copy.describeSets(0), copy.describeSets(1), copy.describeSets(5.5)],
  describeHeatStep: () => [0, 1, 2, 3, 4, 5].map(copy.describeHeatStep),
  describeHours: () => [copy.describeHours(1), copy.describeHours(31)],
  describeWeekdayName: () => [copy.describeWeekdayName("2026-10-12")],
  describeWeekdayShortName: () => [copy.describeWeekdayShortName("2026-10-12")],
  joinInWords: () => [
    copy.joinInWords(["lats"]),
    copy.joinInWords(["lats", "biceps"]),
    copy.joinInWords(["lats", "mid traps", "biceps"]),
  ],
  describeShortDate: () => [copy.describeShortDate("2026-10-12")],
  describeWeekRange: () => [
    copy.describeWeekRange("2026-10-12"),
    copy.describeWeekRange("2026-10-26"),
  ],
  describeMoment: () => [copy.describeMoment(THURSDAY, LONDON)],
  describeSavedMoment: () => [copy.describeSavedMoment(THURSDAY, LONDON)],
  describePlannedSessions: () => [
    copy.describePlannedSessions([SATURDAYS_PUSH]),
    copy.describePlannedSessions([FRIDAYS_PULL, SATURDAYS_PUSH]),
    copy.describePlannedSessions([{ localDate: "2026-10-17", routineDayName: null }]),
  ],
  describeProjectedAssumption: () => [copy.describeProjectedAssumption([SATURDAYS_PUSH])],
  describeNothingLogged: () => [copy.describeNothingLogged(14), copy.describeNothingLogged(1)],
  describeLegendCaption: () =>
    (["heat", "volume", "gap"] as const).flatMap((scale) =>
      (["mobile", "web"] as const).map((surface) =>
        copy.describeLegendCaption({ scale, surface, onPlanToleranceSets: 1 }),
      ),
    ),
  describeBodyMapHeader: () =>
    (["heat", "volume", "gap"] as const).flatMap((scale) =>
      (["actual", "projected"] as const).flatMap((view) => {
        const { viewLabel, subLine, toggleLabel } = copy.describeBodyMapHeader({
          ...header,
          scale,
          view,
          at: SUNDAY,
          isToday: false,
        });
        return [viewLabel, subLine, ...(toggleLabel === null ? [] : [toggleLabel])];
      }),
    ),
  describeGapNote: () => [
    copy.describeGapNote([], "push muscles"),
    copy.describeGapNote([SATURDAYS_PUSH], "push muscles"),
    copy.describeGapNote([FRIDAYS_PULL, SATURDAYS_PUSH], "those muscles"),
  ],
  describeBodyFigureLabel: () => [
    copy.describeBodyFigureLabel({
      scale: "heat",
      view: "actual",
      side: "front",
      hint: "muscleList",
    }),
    copy.describeBodyFigureLabel({ scale: "volume", view: "projected", side: "back", hint: null }),
    copy.describeBodyFigureLabel({
      scale: "gap",
      view: "actual",
      side: "front",
      hint: "openBodyMap",
    }),
  ],
  describeScrubberDay: () =>
    (["logged", "planned", "missed", "in_progress"] as const)
      .map(
        (kind) =>
          copy.describeScrubberDay({
            localDate: "2026-10-17",
            isToday: kind === "in_progress",
            onlyInProjected: kind === "planned",
            state: { kind, routineDayName: "Push" },
          }).accessibleName,
      )
      .concat(
        copy.describeScrubberDay({
          localDate: "2026-10-14",
          isToday: false,
          onlyInProjected: false,
          state: { kind: "rest" },
        }).accessibleName,
      ),
  describeReadyIn: () => [
    copy.describeReadyIn(0),
    copy.describeReadyIn(1),
    copy.describeReadyIn(31),
  ],
  describeReadyInShort: () => [
    copy.describeReadyInShort(0),
    copy.describeReadyInShort(1),
    copy.describeReadyInShort(31),
  ],
  describeMuscleListRow: () => {
    const row = copy.describeMuscleListRow({
      muscle: "delt_side",
      heatPercent: 3,
      heatStep: 0,
      readyInHours: 1,
    });
    return [row.name, row.heatText, row.status, row.accessibleName];
  },
  describeDashboardBodyMapCard: () =>
    dashboardInputs.flatMap((input) => {
      const card = copy.describeDashboardBodyMapCard(input);
      return [
        card.warmestLine,
        card.accessibleName,
        ...(card.todayLine === null ? [] : [card.todayLine]),
      ];
    }),
  describeWebListCaption: () => [
    copy.describeWebListCaption({ scale: "heat", moreAtRest: 10 }),
    copy.describeWebListCaption({ scale: "volume", moreUnder: 3, notTargeted: 7 }),
    copy.describeWebListCaption({ scale: "gap", moreOnPlan: 3, notInPlan: 7 }),
  ],
  describeVolumeListRow: () =>
    (["projected", "actual"] as const).flatMap((view) => {
      const row = copy.describeVolumeListRow({
        muscle: "triceps",
        weeklySets: 15,
        status: "productive",
        view,
        weekEnd: "2026-10-18",
      });
      return [row.name, row.valueText, row.status, row.accessibleName];
    }),
  describeGapListRow: () => {
    const row = copy.describeGapListRow({
      muscle: "triceps",
      done: 7.5,
      planned: 15,
      status: "behind",
    });
    return [row.name, row.valueText, row.status, row.accessibleName];
  },
  describeFigureRowValue: () => [
    copy.describeFigureRowValue("male"),
    copy.describeFigureRowValue("female"),
  ],
};
