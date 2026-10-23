import { describeHistoryRow, describeHistoryWeek } from "@keylow/core/copy";
import { View } from "react-native";

import { SessionRow } from "../SessionRow";
import { GroupedList, Text } from "../ui";

import type { HistoryWeekSectionProps } from "./types";

/**
 * One calendar week of the history list, as the `history · list` board draws it: its name and its total
 * over a card of the week's sessions, newest first. The words are core's (`describeHistoryWeek` and
 * `describeHistoryRow`). The session in progress is a row like the others, in its week, that resumes the
 * session where the others open their detail.
 */
export function HistoryWeekSection({
  week,
  thisWeekStart,
  onOpenSession,
  onResumeSession,
}: HistoryWeekSectionProps) {
  const copy = describeHistoryWeek(week, thisWeekStart);

  return (
    <View className="gap-2">
      <View className="flex-row items-baseline justify-between gap-3 px-1">
        <Text className="min-w-0 shrink" role="heading" tone="muted" variant="caption">
          {copy.name}
        </Text>
        <Text className="shrink-0" tone="secondary" variant="caption">
          {copy.total}
        </Text>
      </View>
      <GroupedList hidesTitle title={copy.name}>
        {week.sessions.map((session) => {
          const row = describeHistoryRow({
            localDate: session.local_date,
            summary: session.summary,
          });

          return (
            <SessionRow
              key={session.id}
              accessibilityLabel={row.accessibleName}
              dayOfMonth={row.dayOfMonth}
              meta={row.meta}
              muscles={row.muscles}
              title={row.name}
              weekday={row.weekday}
              onPress={() => {
                if (row.isInProgress) {
                  onResumeSession();
                } else {
                  onOpenSession(session.id);
                }
              }}
            />
          );
        })}
      </GroupedList>
    </View>
  );
}
