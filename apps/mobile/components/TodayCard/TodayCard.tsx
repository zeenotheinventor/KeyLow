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
 * so none is a dead control. Start, Resume, Log another session and Log a session are dimmed when
 * `isStartAndResumeDisabled`, and View session is not, since it reads what is saved. Log another session
 * (Done) and Log a session (rest day) are drawn on no board (KEY-492): they are secondary buttons like the
 * no routine card's, under the card's copy.
 */
export function TodayCard({
  card,
  context,
  isStartAndResumeDisabled,
  isStarting = false,
  onStart,
  onResume,
  onViewSession,
  onLogAnother,
  onLogSession,
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
            {onLogAnother === undefined ? null : (
              <Button
                className="mt-3"
                disabled={isStartAndResumeDisabled}
                fullWidth
                loading={isStarting}
                variant="secondary"
                onPress={onLogAnother}
              >
                {copy.logAnotherAction}
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
            {onLogSession === undefined ? null : (
              <Button
                className="mt-3"
                disabled={isStartAndResumeDisabled}
                fullWidth
                loading={isStarting}
                variant="secondary"
                onPress={onLogSession}
              >
                {copy.logSessionAction}
              </Button>
            )}
          </>
        ) : null}
      </View>
    </Card>
  );
}
