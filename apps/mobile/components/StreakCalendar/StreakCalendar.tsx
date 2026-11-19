import { streakMonthOf } from "@keylow/core";
import { STREAK_CALENDAR, describeCalendarDay, describeStreakMonth } from "@keylow/core/copy";
import { View } from "react-native";

import { Icon, Text } from "../ui";

import type { StreakCalendarProps } from "./types";
import type { TextTone } from "../ui";
import type { DayState } from "@keylow/core";

// The classes are written out so Tailwind sees them. Each state is the board's: complete is the accent,
// frozen the protein blue on its muted fill, missed a dashed outline, today at risk the warning colours,
// and a day to come the plain surface.
const dayLooks = {
  complete: { fill: "bg-accent", tone: "accent-foreground" },
  frozen: { fill: "border border-protein bg-protein-muted", tone: "protein-ink" },
  missed: { fill: "border border-dashed border-border-strong", tone: "muted" },
  at_risk: { fill: "border border-warning bg-warning-muted", tone: "warning-ink" },
  future: { fill: "bg-surface", tone: "muted" },
} satisfies Record<DayState, { fill: string; tone: TextTone }>;

const swatchClassName = "h-[14px] w-[14px] rounded-[4px]";

const legend = [
  { state: "complete", label: STREAK_CALENDAR.legend.complete },
  { state: "frozen", label: STREAK_CALENDAR.legend.frozen },
  { state: "missed", label: STREAK_CALENDAR.legend.missed },
  { state: "at_risk", label: STREAK_CALENDAR.legend.atRisk },
] as const;

function Tile({
  value,
  label,
  tone = "primary",
}: {
  value: number;
  label: string;
  tone?: TextTone;
}) {
  return (
    <View
      accessible
      aria-label={`${value} ${label}`}
      className="flex-1 gap-[2px] rounded-medium border border-border bg-surface p-3"
    >
      <Text tone={tone} variant="numeral-small">
        {value}
      </Text>
      <Text tone="muted" variant="caption">
        {label}
      </Text>
    </View>
  );
}

/**
 * The streak calendar sheet's contents, as board 4 draws them: the title, the current, longest and freezes
 * held, the month Monday to Sunday with each day as core's calendar has it, the legend and the freeze
 * explanation. A frozen day carries a snowflake as well as its fill, so the colour is never the only signal.
 * Nothing is worked out here: the state of each day is core's.
 */
export function StreakCalendar({
  today,
  calendar,
  current,
  longest,
  freezesHeld,
}: StreakCalendarProps) {
  const weeks = streakMonthOf(calendar, today);

  return (
    <View className="gap-4 pb-2">
      <View className="gap-[2px]">
        <View accessible role="heading">
          <Text variant="h2">{STREAK_CALENDAR.title}</Text>
        </View>
        <Text tone="secondary">{STREAK_CALENDAR.subtitle}</Text>
      </View>
      <View className="flex-row gap-2">
        <Tile label={STREAK_CALENDAR.currentLabel} value={current} />
        <Tile label={STREAK_CALENDAR.longestLabel} value={longest} />
        <Tile label={STREAK_CALENDAR.freezesLabel} tone="protein-ink" value={freezesHeld} />
      </View>
      <View className="flex-row items-center justify-between">
        <View accessible role="heading">
          <Text variant="body-strong">{describeStreakMonth(today)}</Text>
        </View>
        <Text tone="muted" variant="caption">
          {STREAK_CALENDAR.weekStartNote}
        </Text>
      </View>
      <View className="gap-[6px]">
        <View aria-hidden className="flex-row gap-[6px]">
          {STREAK_CALENDAR.weekdayLetters.map((letter, index) => (
            // The seven letters repeat (T, S), so the position is the only stable key.

            <View className="flex-1 items-center" key={index}>
              <Text tone="muted" variant="caption">
                {letter}
              </Text>
            </View>
          ))}
        </View>
        {weeks.map((week) => (
          <View className="flex-row gap-[6px]" key={week.find((cell) => cell !== null)?.localDate}>
            {week.map((cell, index) =>
              cell === null ? (
                // A blank before the 1st or after the last day keeps the week's seven columns.

                <View className="h-10 flex-1" key={index} />
              ) : (
                <View
                  accessible
                  aria-label={describeCalendarDay(cell.localDate, cell.state)}
                  className={`h-10 flex-1 flex-row items-center justify-center gap-[2px] rounded-[10px] ${dayLooks[cell.state].fill}`}
                  key={cell.localDate}
                >
                  {cell.state === "frozen" ? (
                    <Icon name="Snowflake" size={12} tone="protein" />
                  ) : null}
                  <Text tone={dayLooks[cell.state].tone} variant="label-small">
                    {Number(cell.localDate.slice(8))}
                  </Text>
                </View>
              ),
            )}
          </View>
        ))}
      </View>
      <View className="flex-row flex-wrap gap-3">
        {legend.map(({ state, label }) => (
          <View className="flex-row items-center gap-[6px]" key={state}>
            <View aria-hidden className={`${swatchClassName} ${dayLooks[state].fill}`} />
            <Text tone="secondary" variant="caption">
              {label}
            </Text>
          </View>
        ))}
      </View>
      <Text tone="secondary">{STREAK_CALENDAR.freezeExplanation}</Text>
    </View>
  );
}
