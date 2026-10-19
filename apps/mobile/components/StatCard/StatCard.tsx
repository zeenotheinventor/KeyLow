import { View } from "react-native";

import { Card, Text } from "../ui";

import type { StatCardProps } from "./types";

/** One of the three cards at the top of the finish screen and of the session detail: a label, a figure and a line under it. The card takes its share of the row. */
export function StatCard({ label, value, note }: StatCardProps) {
  return (
    <View className="min-w-0 flex-1">
      <Card padding={3}>
        <View className="gap-0.5">
          <Text tone="muted" variant="caption">
            {label}
          </Text>
          <Text variant="numeral-small">{value}</Text>
          {note === null ? null : (
            <Text tone="secondary" variant="caption">
              {note}
            </Text>
          )}
        </View>
      </Card>
    </View>
  );
}
