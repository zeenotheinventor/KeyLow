import { TRAIN_HOME, describeTodayCard } from "@keylow/core/copy";
import { View } from "react-native";

import { Badge, Button, Card, Text } from "../ui";
import { SetsProgressBar } from "./SetsProgressBar";

import type { TodayCardProps } from "./types";

/**
 * The Train home's Today card in its four states, as the `train · today`, `train · in-progress` and
 * `train · rest-day` boards draw them: the planned day with Start, the session in progress with its sets and
 * Resume, the finished session with View session, and the rest day with the next day and the muscles still
 * recovering. Every word is core's (`describeTodayCard`). A button is drawn only when its handler is given,
 * so none is a dead control. Start and Resume are dimmed when `isStartAndResumeDisabled`, and View session
 * is not, since it reads what is saved.
 */
export function TodayCard({
  card,
  context,
  isStartAndResumeDisabled,
  isStarting = false,
  onStart,
  onResume,
  onViewSession,
}: TodayCardProps) {
  const copy = describeTodayCard(card, context);

  return (
    <Card aria-label={TRAIN_HOME.todaySectionName} role="region">
      <View className="gap-1">
        <Text tone="muted" variant="caption">
          {copy.heading}
        </Text>
        {copy.kind === "planned" ? (
          <>
            <View className="flex-row items-baseline justify-between gap-3">
              <Text className="min-w-0 shrink" role="heading" variant="h2">
                {copy.title}
              </Text>
              <Text className="shrink-0" tone="secondary" variant="caption">
                {copy.dayLine}
              </Text>
            </View>
            <Text tone="secondary" variant="caption">
              {copy.loadLine}
            </Text>
            {onStart === undefined ? null : (
              <Button
                className="mt-3"
                disabled={isStartAndResumeDisabled}
                fullWidth
                icon="Play"
                loading={isStarting}
                onPress={onStart}
              >
                {copy.action}
              </Button>
            )}
          </>
        ) : null}
        {copy.kind === "in_progress" ? (
          <>
            <View className="flex-row items-baseline justify-between gap-3">
              <Text className="min-w-0 shrink" role="heading" variant="h2">
                {copy.title}
              </Text>
              <Badge dot tone="accent">
                {copy.statusLabel}
              </Badge>
            </View>
            <Text tone="secondary" variant="caption">
              {copy.summaryLine}
            </Text>
            {card.kind === "in_progress" && card.setsPlanned > 0 ? (
              <SetsProgressBar setsLogged={card.setsLogged} setsPlanned={card.setsPlanned} />
            ) : null}
            {onResume === undefined ? null : (
              <Button
                className="mt-3"
                disabled={isStartAndResumeDisabled}
                fullWidth
                icon="Play"
                onPress={onResume}
              >
                {copy.action}
              </Button>
            )}
          </>
        ) : null}
        {copy.kind === "done" ? (
          <>
            <View className="flex-row items-baseline justify-between gap-3">
              <Text className="min-w-0 shrink" role="heading" variant="h2">
                {copy.title}
              </Text>
              <Badge dot tone="success">
                {copy.statusLabel}
              </Badge>
            </View>
            <Text tone="secondary" variant="caption">
              {copy.summaryLine}
            </Text>
            {onViewSession === undefined ? null : (
              <Button
                className="-ml-2 mb-1 mt-2 self-start"
                size="sm"
                tone="accent-ink"
                variant="ghost"
                onPress={onViewSession}
              >
                {copy.action}
              </Button>
            )}
          </>
        ) : null}
        {copy.kind === "rest" ? (
          <>
            <Text role="heading" variant="h2">
              {copy.title}
            </Text>
            {copy.body === null ? null : <Text tone="secondary">{copy.body}</Text>}
          </>
        ) : null}
      </View>
    </Card>
  );
}
