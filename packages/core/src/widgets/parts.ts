import { WARMEST_MUSCLES_SHOWN } from "./constants";
import { openAction, WIDGET_PATHS } from "./links";
import { describeHeatStep } from "../copy/bodyMap";
import { DATE_PICKER } from "../copy/datePicker";
import { MACRO_NAMES, describeMacroTarget } from "../copy/diaryRing";
import { MUSCLE_NAMES } from "../copy/muscleNames";
import {
  describeEatenOfTarget,
  describeEatenOfTargetWithUnit,
  describeEatenWithoutTarget,
  describeOfflineStatus,
  describeRingCaption,
  describeRingName,
  WIDGET_ACTIONS,
  WIDGET_STATES,
} from "../copy/widgets";
import { formatClockTime } from "../dates/formatClockTime";
import { ringNumbers } from "../diary/ringMaths";
import { formatCalories, formatGrams } from "../format/numbers";
import { readMuscleValue } from "../training/bodyFigureReading";
import { warmestMuscles } from "../training/bodyMapValues";

import type { WidgetKind } from "./constants";
import type { DayReading } from "./day";
import type { WidgetAction } from "./links";
import type { WidgetSnapshot } from "./snapshot";
import type {
  HeatRowView,
  MacroRowView,
  MessageState,
  MessageViewModel,
  RingView,
  WeekDotView,
  WidgetButton,
  WidgetContext,
  WidgetStatus,
} from "./types";
import type { WeekSummary } from "../diary/rules/weekSummary";

export const button = (
  label: string,
  action: WidgetAction,
  options: Partial<Pick<WidgetButton, "accessibleName" | "icon" | "emphasis">> = {},
): WidgetButton => ({
  label,
  accessibleName: options.accessibleName ?? label,
  icon: options.icon ?? null,
  emphasis: options.emphasis ?? "secondary",
  action,
});

export const openKiLoButton = (emphasis: "primary" | "secondary"): WidgetButton =>
  button(WIDGET_ACTIONS.openKiLo, openAction(WIDGET_PATHS.app), { emphasis });

type MessageContent = Readonly<{
  eyebrow: string;
  trailing?: string;
  headline: string;
  headlineRole?: "text" | "danger";
  body: string | null;
  actions: readonly WidgetButton[];
}>;

export const message = (
  kind: WidgetKind,
  state: MessageState,
  content: MessageContent,
): MessageViewModel => ({
  kind,
  state,
  eyebrow: content.eyebrow,
  trailing: content.trailing ?? null,
  headline: content.headline,
  headlineRole: content.headlineRole ?? "text",
  body: content.body,
  actions: content.actions,
  accessibleName: [content.headline, content.body].filter((part) => part !== null).join(" "),
});

export const signedOutMessage = (kind: WidgetKind): MessageViewModel =>
  message(kind, "signed_out", {
    ...WIDGET_STATES.signedOut,
    actions: [openKiLoButton("primary")],
  });

export const noDataMessage = (kind: WidgetKind): MessageViewModel =>
  message(kind, "no_data", { ...WIDGET_STATES.noData, actions: [openKiLoButton("secondary")] });

export const offlineStatus = (
  snapshot: WidgetSnapshot,
  context: WidgetContext,
): WidgetStatus | null =>
  context.isOffline === true
    ? {
        text: describeOfflineStatus(formatClockTime(new Date(snapshot.builtAt), snapshot.timeZone)),
        role: "warning",
      }
    : null;

export const ringOf = (day: DayReading, isOffline: boolean): RingView => {
  const { eatenFraction, remainingCalories, hasTarget, isOver } = ringNumbers(
    day.eaten.kcal,
    day.targetKcal ?? 0,
  );
  const target = day.targetKcal ?? 0;

  return {
    fraction: eatenFraction,
    hasTarget,
    value: formatCalories(remainingCalories),
    caption: describeRingCaption(!hasTarget ? "eaten" : isOver ? "over" : "left"),
    eatenOfTarget: hasTarget ? describeEatenOfTarget(day.eaten.kcal, target) : null,
    eatenOfTargetWithUnit: hasTarget ? describeEatenOfTargetWithUnit(day.eaten.kcal, target) : null,
    accessibleName: hasTarget
      ? describeRingName(day.eaten.kcal, target)
      : describeEatenWithoutTarget(day.eaten.kcal),
    fillRole: isOffline ? "textSubtle" : "accent",
    trackRole: "track",
  };
};

export const macrosOf = (
  day: DayReading,
  snapshot: WidgetSnapshot,
  isOffline: boolean,
): MacroRowView[] => {
  const targets = snapshot.targets;
  const rows = [
    { label: MACRO_NAMES.protein, eaten: day.eaten.proteinG, target: targets?.proteinG ?? 0 },
    { label: MACRO_NAMES.carbs, eaten: day.eaten.carbsG, target: targets?.carbsG ?? 0 },
    { label: MACRO_NAMES.fat, eaten: day.eaten.fatG, target: targets?.fatG ?? 0 },
  ];

  return rows.map(({ label, eaten, target }) => ({
    label,
    value: `${formatGrams(eaten)} ${describeMacroTarget(target)}`,
    fraction: target > 0 ? Math.min(1, eaten / target) : 0,
    fillRole: isOffline ? "textSubtle" : "accent",
    trackRole: "track",
  }));
};

export const dotsOf = (week: WeekSummary): WeekDotView[] =>
  week.markers.map((marker, position) => {
    const letter = DATE_PICKER.weekdays[position]?.letter ?? "";
    if (marker.state === "today") {
      return marker.isComplete
        ? { letter, fill: "filled", role: "accent", isToday: true }
        : { letter, fill: "outline", role: "accent", isToday: true };
    }

    return {
      letter,
      fill: "filled",
      role: marker.state === "complete" ? "accent" : "track",
      isToday: false,
    };
  });

/** The warmest muscles now, each with its heat step's name and tone. */
export const heatRowsOf = (day: DayReading): HeatRowView[] =>
  warmestMuscles(day.muscleStates, WARMEST_MUSCLES_SHOWN).map(({ muscle }) => {
    const step = day.heatSteps[muscle];

    return {
      muscle,
      name: MUSCLE_NAMES[muscle],
      stepName: describeHeatStep(step),
      dotRole: readMuscleValue("heat", step).tone,
    };
  });
