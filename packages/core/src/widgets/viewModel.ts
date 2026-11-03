import { MILLISECONDS_PER_MINUTE } from "./constants";
import { readDay } from "./day";
import { WidgetError } from "./error";
import { openAction, startSessionPath, WIDGET_PATHS } from "./links";
import {
  button,
  dotsOf,
  heatRowsOf,
  macrosOf,
  message,
  noDataMessage,
  offlineStatus,
  openKiLoButton,
  ringOf,
  signedOutMessage,
} from "./parts";
import { isUndoWindowOpen } from "./undoWindow";
import {
  BODY_MAP,
  describeDashboardBodyMapCard,
  describeDashboardVolumeCard,
  type TodayPlan,
} from "../copy/bodyMap";
import { describeDashboardCard } from "../copy/dashboard";
import { TRAIN_TODAY_CARD } from "../copy/train";
import { WEEK_AVERAGES } from "../copy/weekAverages";
import { describeDaysComplete, describeThisWeekCard } from "../copy/weekCard";
import {
  describeAverageCaption,
  describeAverageLine,
  describeBodyMapEyebrow,
  describeExerciseProgress,
  describeFoodEnergy,
  describeGlanceEyebrow,
  describeHeatChip,
  describeLastTime,
  describeLogAgainName,
  describeLogged,
  describePlanLine,
  describePlanSubtitle,
  describeSessionEyebrow,
  describeSessionLine,
  describeSetProgress,
  describeTodayEyebrow,
  describeWeekEyebrow,
  describeWeighInAge,
  WIDGET_ACTIONS,
  WIDGET_EYEBROWS,
  WIDGET_NO_WEIGH_INS,
  WIDGET_SET_WORDS,
  WIDGET_STATES,
} from "../copy/widgets";
import { dayNumber } from "../dates/calendarDay";
import { formatCalories, formatWeightValue } from "../format/numbers";
import { readMuscleValue } from "../training/bodyFigureReading";
import { warmestMuscles } from "../training/bodyMapValues";
import { displayLoad } from "../training/loads";
import { MUSCLE_IDS } from "../training/muscles";
import { VOLUME_STATUSES } from "../training/muscleState";
import { TRAINING_PARAMS_V2 } from "../training/params";
import { displayWeight } from "../weight/units";

import type { WidgetKind } from "./constants";
import type { DayReading } from "./day";
import type { WidgetSource } from "./parse";
import type { PendingUndo, WidgetSnapshot } from "./snapshot";
import type {
  FigureView,
  LogAgainRowView,
  MessageViewModel,
  ReadyViewModel,
  TrainingViewModel,
  WidgetColourRole,
  WidgetContext,
  WidgetViewModel,
} from "./types";
import type { MuscleId } from "../training/muscles";

const FIGURE_TONES = {
  heat: [0, 1, 2, 3, 4, 5].map((step) => readMuscleValue("heat", step).tone),
  volume: VOLUME_STATUSES.map((_, index) => readMuscleValue("volume", index).tone),
} as const;

const dashboardCardName = (day: DayReading, snapshot: WidgetSnapshot): string => {
  const targets = snapshot.targets;

  return describeDashboardCard(
    {
      kcal: day.eaten.kcal,
      protein_g: day.eaten.proteinG,
      carbs_g: day.eaten.carbsG,
      fat_g: day.eaten.fatG,
    },
    {
      kcal: day.targetKcal,
      protein_g: targets?.proteinG ?? null,
      carbs_g: targets?.carbsG ?? null,
      fat_g: targets?.fatG ?? null,
    },
  );
};

/** Today's plan as the body map copy reads it, or null when the plan is not known (a new day). */
const todayPlanOf = (snapshot: WidgetSnapshot, day: DayReading): TodayPlan | null => {
  if (day.isNewDay) {
    return null;
  }
  const { plan } = snapshot.training;

  return plan === null
    ? { kind: "rest" }
    : { kind: "session", routineDayName: plan.dayName, plannedSets: plan.setCount };
};

/** The undo record when its action matches and its window is still open at `now`. */
const openUndo = (
  context: WidgetContext,
  action: PendingUndo["action"],
  now: Date,
): PendingUndo | null => {
  const undo = context.pendingUndo ?? null;
  if (undo?.action !== action) {
    return null;
  }

  return isUndoWindowOpen(undo.at, now) ? undo : null;
};

const logGridButtons = () => [
  button(WIDGET_ACTIONS.search.label, openAction(WIDGET_PATHS.foods), {
    accessibleName: WIDGET_ACTIONS.search.name,
    icon: "search",
  }),
  button(WIDGET_ACTIONS.scan.label, openAction(WIDGET_PATHS.scan), {
    accessibleName: WIDGET_ACTIONS.scan.name,
    icon: "scan",
  }),
  button(WIDGET_ACTIONS.quickAdd.label, openAction(WIDGET_PATHS.quickAdd), {
    accessibleName: WIDGET_ACTIONS.quickAdd.name,
    icon: "add",
  }),
  button(WIDGET_ACTIONS.weight.label, openAction(WIDGET_PATHS.weightEntry), {
    accessibleName: WIDGET_ACTIONS.weight.name,
    icon: "weight",
  }),
];

const todayLoggingButtons = () => [
  button(WIDGET_ACTIONS.logFood.label, openAction(WIDGET_PATHS.foods), {
    accessibleName: WIDGET_ACTIONS.logFood.name,
    icon: "search",
    emphasis: "primary",
  }),
  button(WIDGET_ACTIONS.scan.label, openAction(WIDGET_PATHS.scan), {
    accessibleName: WIDGET_ACTIONS.scan.name,
    icon: "scan",
  }),
  button(WIDGET_ACTIONS.quickAdd.label, openAction(WIDGET_PATHS.quickAdd), {
    accessibleName: WIDGET_ACTIONS.quickAdd.name,
    icon: "add",
  }),
  button(WIDGET_ACTIONS.recipe.label, openAction(WIDGET_PATHS.recipes), {
    accessibleName: WIDGET_ACTIONS.recipe.name,
    icon: "recipe",
  }),
];

const noTargetMessage = (kind: WidgetKind, day: DayReading): MessageViewModel =>
  message(kind, "no_target", {
    eyebrow: WIDGET_STATES.noTarget.eyebrow,
    trailing: describeEatenTrailing(day),
    headline: WIDGET_STATES.noTarget.headline,
    body: WIDGET_STATES.noTarget.body,
    actions: [button(WIDGET_ACTIONS.setTarget, openAction(WIDGET_PATHS.targets))],
  });

const describeEatenTrailing = (day: DayReading): string => ringOf(day, false).accessibleName;

const byMuscle = <Value>(valueOf: (muscle: MuscleId) => Value): Record<MuscleId, Value> =>
  // Every id of the list is mapped, so the entries make the full record.
  Object.fromEntries(MUSCLE_IDS.map((muscle) => [muscle, valueOf(muscle)])) as Record<
    MuscleId,
    Value
  >;

const figureOf = (snapshot: WidgetSnapshot, day: DayReading): FigureView => {
  const { scale, figure } = snapshot.bodyMap;
  const values: Readonly<Record<MuscleId, number>> =
    scale === "heat" ? day.heatSteps : day.volumeValues;

  return {
    figure,
    scale,
    tones: byMuscle((muscle) => readMuscleValue(scale, values[muscle]).tone),
  };
};

const logAgainView = (
  snapshot: WidgetSnapshot,
  context: WidgetContext,
  now: Date,
): ReadyViewModel | MessageViewModel => {
  const undo = openUndo(context, "log_again", now);
  const rows: LogAgainRowView[] = snapshot.recentFoods.map((food) => ({
    type: "food",
    name: food.name,
    energy: describeFoodEnergy(food.kcal),
    accessibleName: describeLogAgainName(food.name, food.kcal),
    action: { type: "log_again", entryId: food.entryId },
  }));
  if (undo !== null) {
    // The row the tap repeated, when the record names it. Otherwise the new row, if the snapshot has it.
    const source = snapshot.recentFoods.findIndex(
      (food) => food.entryId === (undo.sourceEntryId ?? undo.rowId),
    );
    const position = Math.max(source, 0);
    rows[position] = {
      type: "logged",
      text: describeLogged(snapshot.recentFoods[source]?.name ?? null),
      undoLabel: WIDGET_ACTIONS.undo,
      action: { type: "undo", action: undo.action, rowId: undo.rowId },
    };
  }
  if (rows.length === 0) {
    return message("log_again", "no_recent_foods", {
      ...WIDGET_STATES.noRecentFoods,
      actions: [
        button(WIDGET_ACTIONS.logFood.label, openAction(WIDGET_PATHS.foods), {
          emphasis: "primary",
        }),
      ],
    });
  }

  return {
    kind: "log_again",
    state: "ready",
    eyebrow: WIDGET_EYEBROWS.logAgain,
    rows,
    accessibleName: rows
      .map((row) => (row.type === "food" ? row.accessibleName : row.text))
      .join(". "),
    tap: openAction(WIDGET_PATHS.foods),
    status: null,
  };
};

const trainingView = (
  snapshot: WidgetSnapshot,
  day: DayReading | null,
  context: WidgetContext,
  now: Date,
): TrainingViewModel | MessageViewModel => {
  const { plan, session } = snapshot.training;
  const base = { kind: "training", state: "ready", status: null } as const;
  if (day === null) {
    return noDataMessage("training");
  }
  if (session !== null) {
    const { next } = session;
    const minutes = Math.max(
      0,
      Math.floor((now.getTime() - new Date(session.startedAt).getTime()) / MILLISECONDS_PER_MINUTE),
    );
    const undo = openUndo(context, "log_set", now);
    const unit = snapshot.weightUnit;
    const eyebrow = describeSessionEyebrow(minutes);
    const logButton =
      next === null
        ? button(WIDGET_ACTIONS.openSession, openAction(WIDGET_PATHS.session), {
            emphasis: "primary",
          })
        : button(
            WIDGET_ACTIONS.logSet,
            {
              type: "log_set",
              sessionId: session.id,
              exerciseId: next.exerciseId,
              setNumber: next.setNumber,
            },
            { icon: "check", emphasis: "primary" },
          );
    const title = next?.exerciseName ?? session.dayName ?? TRAIN_TODAY_CARD.sessionName;

    return {
      ...base,
      phase: "session",
      eyebrow,
      progress:
        next === null ? null : describeExerciseProgress(next.exerciseNumber, next.exerciseCount),
      title,
      setLabel: next === null ? null : describeSetProgress(next.setNumber, next.setCount),
      load: next?.loadKg == null ? null : { value: displayLoad(next.loadKg, unit), unit },
      reps: next?.reps == null ? null : { value: String(next.reps), unit: WIDGET_SET_WORDS.reps },
      lastTime:
        next?.lastTime == null
          ? null
          : describeLastTime(
              next.lastTime.loadKg === null ? null : displayLoad(next.lastTime.loadKg, unit),
              next.lastTime.reps,
            ),
      button: logButton,
      undo:
        undo === null
          ? null
          : {
              text: describeLogged(null),
              undoLabel: WIDGET_ACTIONS.undo,
              action: { type: "undo", action: undo.action, rowId: undo.rowId },
            },
      accessibleName: [title, eyebrow].join(". "),
      tap: openAction(WIDGET_PATHS.session),
    };
  }
  if (day.isNewDay) {
    return noDataMessage("training");
  }
  if (plan === null) {
    return message("training", "rest_day", {
      ...WIDGET_STATES.restDay,
      actions: [
        button(WIDGET_ACTIONS.emptySession, openAction(startSessionPath("empty", snapshot.nonce))),
        button(WIDGET_ACTIONS.openTrain, openAction(WIDGET_PATHS.train)),
      ],
    });
  }
  const subtitle = describePlanSubtitle(plan.exerciseCount, plan.exerciseNames);

  return {
    ...base,
    phase: "start",
    eyebrow: WIDGET_EYEBROWS.trainToday,
    title: plan.dayName,
    subtitle,
    buttons: [
      button(WIDGET_ACTIONS.startSession, openAction(startSessionPath("planned", snapshot.nonce)), {
        icon: "play",
        emphasis: "primary",
      }),
      button(WIDGET_ACTIONS.emptySession, openAction(startSessionPath("empty", snapshot.nonce))),
    ],
    accessibleName: `${plan.dayName}. ${subtitle}`,
    tap: openAction(WIDGET_PATHS.train),
  };
};

const weighInView = (
  snapshot: WidgetSnapshot,
  day: DayReading,
  status: ReadyViewModel["status"],
) => {
  const last = snapshot.lastWeighIn;
  const logToday = button(WIDGET_ACTIONS.logToday, openAction(WIDGET_PATHS.weightEntry), {
    icon: "add",
    emphasis: "primary",
  });
  const shown = last === null ? null : displayWeight(last.weightKg, snapshot.weightUnit);
  const value = shown === null ? WIDGET_NO_WEIGH_INS : formatWeightValue(shown);
  const unit = shown === null ? null : snapshot.weightUnit;
  const caption =
    last === null ? null : describeWeighInAge(dayNumber(day.localDate) - dayNumber(last.localDate));

  return {
    kind: "weigh_in",
    state: "ready",
    eyebrow: WIDGET_EYEBROWS.weight,
    value,
    unit,
    caption,
    button: logToday,
    accessibleName: [WIDGET_EYEBROWS.weight, value, unit, caption].filter(Boolean).join(" "),
    tap: openAction(WIDGET_PATHS.weightEntry),
    status,
  } as const;
};

/**
 * What a widget of one kind shows at `now`: every string already formatted from the copy, and colour roles
 * rather than colours (ADR 0007, "The snapshot contract, in core"). The branches of boards A, B and D all
 * live here. A source with no snapshot is the signed-out or "no data yet" state, and a snapshot more than
 * one midnight old is "no data yet" too. Throws a `WidgetError` when `now` is not a valid date.
 */
export const widgetViewModel = (
  source: WidgetSource,
  kind: WidgetKind,
  now: Date,
  context: WidgetContext = {},
): WidgetViewModel => {
  if (Number.isNaN(now.getTime())) {
    throw new WidgetError("view_model", "invalid_now");
  }
  if (source.status === "signed_out") {
    return signedOutMessage(kind);
  }
  if (source.status === "no_data") {
    return kind === "log_grid" ? logGridView(null) : noDataMessage(kind);
  }
  const { snapshot } = source;
  if (context.failure === "couldnt_log" && (kind === "log_again" || kind === "training")) {
    return message(kind, "couldnt_log", {
      eyebrow:
        kind === "log_again" ? WIDGET_EYEBROWS.logAgain : WIDGET_STATES.sessionMovedOn.eyebrow,
      headline: WIDGET_STATES.couldntLog.headline,
      headlineRole: "danger",
      body: WIDGET_STATES.couldntLog.body,
      actions: [openKiLoButton("secondary")],
    });
  }
  if (context.failure === "couldnt_undo" && (kind === "log_again" || kind === "training")) {
    return message(kind, "couldnt_undo", {
      eyebrow:
        kind === "log_again" ? WIDGET_EYEBROWS.logAgain : WIDGET_STATES.sessionMovedOn.eyebrow,
      headline: WIDGET_STATES.couldntUndo.headline,
      headlineRole: "danger",
      body: WIDGET_STATES.couldntUndo.body,
      actions: [openKiLoButton("secondary")],
    });
  }
  if (context.failure === "session_moved_on" && kind === "training") {
    return message(kind, "session_moved_on", {
      ...WIDGET_STATES.sessionMovedOn,
      actions: [
        button(WIDGET_ACTIONS.openSession, openAction(WIDGET_PATHS.session), {
          emphasis: "primary",
        }),
      ],
    });
  }
  const day = readDay(snapshot, now);
  const status = offlineStatus(snapshot, context);
  if (kind === "log_grid") {
    return logGridView(status);
  }
  if (kind === "log_again") {
    return logAgainView(snapshot, context, now);
  }
  if (kind === "training") {
    return trainingView(snapshot, day, context, now);
  }
  if (day === null) {
    return noDataMessage(kind);
  }
  const isOffline = context.isOffline === true;
  switch (kind) {
    case "today_ring":
      return day.targetKcal === null
        ? noTargetMessage(kind, day)
        : {
            kind,
            state: "ready",
            eyebrow: WIDGET_EYEBROWS.today,
            ring: ringOf(day, isOffline),
            accessibleName: dashboardCardName(day, snapshot),
            tap: openAction(WIDGET_PATHS.diary),
            status,
          };
    case "today_macros":
      return day.targetKcal === null
        ? noTargetMessage(kind, day)
        : {
            kind,
            state: "ready",
            eyebrow: describeTodayEyebrow(day.localDate),
            ring: ringOf(day, isOffline),
            macros: macrosOf(day, snapshot, isOffline),
            accessibleName: dashboardCardName(day, snapshot),
            tap: openAction(WIDGET_PATHS.diary),
            status,
          };
    case "this_week": {
      const { week } = day;
      const hasAverage = !week.isFirstDay && week.averageKcal !== null;

      return {
        kind,
        state: "ready",
        eyebrow: describeWeekEyebrow(week.weekStart),
        progress: describeDaysComplete(week.daysComplete, week.daysSoFar),
        average:
          hasAverage && week.averageKcal !== null
            ? {
                value: formatCalories(week.averageKcal),
                caption: describeAverageCaption(week.targetKcal),
              }
            : null,
        note: week.isFirstDay
          ? WEEK_AVERAGES.startsTomorrow
          : week.averageKcal === null
            ? WEEK_AVERAGES.nothingBeforeToday
            : null,
        barFraction: week.barFill,
        dots: dotsOf(week),
        accessibleName: describeThisWeekCard(week, "week"),
        tap: openAction(WIDGET_PATHS.week),
        status,
      };
    }
    case "body_heat": {
      const rows = heatRowsOf(day);
      const card = describeDashboardBodyMapCard({
        warmest: warmestMuscles(day.muscleStates),
        today: todayPlanOf(snapshot, day),
        heatWindowDays: TRAINING_PARAMS_V2.heatWindowDays,
        opensBodyMap: true,
      });

      return {
        kind,
        state: "ready",
        eyebrow: WIDGET_EYEBROWS.heatNow,
        rows,
        emptyLine: rows.length === 0 ? card.warmestLine : null,
        todayLine: card.todayLine,
        accessibleName: card.accessibleName,
        tap: openAction(WIDGET_PATHS.bodyMap),
        status,
      };
    }
    case "today_glance": {
      const { week } = day;
      const rows = heatRowsOf(day);
      const [hottest] = warmestMuscles(day.muscleStates, 1);
      const { plan, session } = snapshot.training;
      const trainingLine =
        session !== null
          ? describeSessionLine(session.dayName)
          : day.isNewDay
            ? null
            : plan === null
              ? TRAIN_TODAY_CARD.restTitle
              : describePlanLine(plan.dayName, plan.exerciseCount);

      return {
        kind,
        state: "ready",
        eyebrow: describeGlanceEyebrow(day.localDate),
        ring: ringOf(day, isOffline),
        macros: macrosOf(day, snapshot, isOffline),
        week: {
          eyebrow: WIDGET_EYEBROWS.thisWeek,
          line:
            week.averageKcal === null || week.isFirstDay
              ? week.isFirstDay
                ? WEEK_AVERAGES.startsTomorrow
                : WEEK_AVERAGES.nothingBeforeToday
              : describeAverageLine(week.averageKcal),
          dots: dotsOf(week),
        },
        training:
          trainingLine === null
            ? null
            : {
                eyebrow: WIDGET_EYEBROWS.trainingToday,
                line: trainingLine,
                heatChip:
                  hottest === undefined || rows.length === 0
                    ? null
                    : {
                        text: describeHeatChip(hottest.muscle, day.heatSteps[hottest.muscle]),
                        dotRole: readMuscleValue("heat", day.heatSteps[hottest.muscle]).tone,
                      },
              },
        accessibleName: dashboardCardName(day, snapshot),
        tap: openAction(WIDGET_PATHS.dashboard),
        status,
      };
    }
    case "body_map": {
      const { scale } = snapshot.bodyMap;
      const isHeat = scale === "heat";
      const rows = isHeat ? heatRowsOf(day) : [];
      const heatCard = describeDashboardBodyMapCard({
        warmest: warmestMuscles(day.muscleStates),
        today: todayPlanOf(snapshot, day),
        heatWindowDays: TRAINING_PARAMS_V2.heatWindowDays,
        opensBodyMap: true,
      });
      const volumeCard = describeDashboardVolumeCard({
        values: day.volumeValues,
        today: todayPlanOf(snapshot, day),
      });
      const legend: readonly WidgetColourRole[] = isHeat ? FIGURE_TONES.heat : FIGURE_TONES.volume;

      return {
        kind,
        state: "ready",
        eyebrow: describeBodyMapEyebrow(scale),
        figure: figureOf(snapshot, day),
        rows,
        summaryLine: isHeat
          ? rows.length === 0
            ? heatCard.warmestLine
            : null
          : volumeCard.summaryLine,
        legend: {
          swatches: legend,
          startLabel: isHeat
            ? BODY_MAP.dashboardCard.coolestStep
            : BODY_MAP.dashboardCard.volumeBottomStep,
          endLabel: isHeat
            ? BODY_MAP.dashboardCard.hottestStep
            : BODY_MAP.dashboardCard.volumeTopStep,
        },
        accessibleName: isHeat ? heatCard.accessibleName : volumeCard.accessibleName,
        tap: openAction(WIDGET_PATHS.bodyMap),
        status,
      };
    }
    case "today_logging":
      return {
        kind,
        state: "ready",
        ring: ringOf(day, isOffline),
        buttons: todayLoggingButtons(),
        accessibleName: dashboardCardName(day, snapshot),
        tap: openAction(WIDGET_PATHS.diary),
        status,
      };
    case "weigh_in":
      return weighInView(snapshot, day, status);
  }
};

const logGridView = (status: ReadyViewModel["status"]): ReadyViewModel => ({
  kind: "log_grid",
  state: "ready",
  buttons: logGridButtons(),
  accessibleName: logGridButtons()
    .map((gridButton) => gridButton.accessibleName)
    .join(". "),
  tap: openAction(WIDGET_PATHS.app),
  status,
});
