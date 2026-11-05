import { SUGGESTION_NO_GOAL } from "@keylow/core/copy";
import { Pressable, View } from "react-native";

import { Button, Card, Icon, Text } from "../ui";

import type { SuggestionCardProps, SuggestionOfferState } from "./types";
import type { IconName } from "../ui";
import type { ReactNode } from "react";

// The swatch before each reason, written out so Tailwind sees them. The volume swatch is the nearest token
// to the board's `--volume-under`, which the live tokens no longer have.
const reasonSwatchClassNames = {
  volume: "bg-volume-maintaining",
  heat: "bg-heat-1",
  length: "bg-text-muted",
} as const;

const tileClassNames = {
  accent: "bg-accent-muted",
  success: "bg-success-muted",
  raised: "bg-surface-raised",
} as const;

/** The 36 point tile before a card's words: a tinted square with an icon in it. */
function Tile({
  icon,
  tile,
  tone,
}: {
  icon: IconName;
  tile: keyof typeof tileClassNames;
  tone: "accent-ink" | "success" | "secondary";
}) {
  return (
    <View
      className={`h-9 w-9 shrink-0 items-center justify-center rounded-small ${tileClassNames[tile]}`}
    >
      <Icon name={icon} tone={tone} />
    </View>
  );
}

function Offer({
  state,
  onDismiss,
  onOpenDetail,
}: {
  state: SuggestionOfferState;
  onDismiss: SuggestionCardProps["onDismiss"];
  onOpenDetail: SuggestionCardProps["onOpenDetail"];
}) {
  const { copy } = state;
  const words = (
    <View className="min-w-0 flex-1 gap-0.5">
      <Text tone="muted" variant="caption">
        {copy.label}
      </Text>
      <Text variant="body-strong">{copy.headline}</Text>
    </View>
  );
  return (
    <Card aria-label={copy.cardName} role="region">
      <View className="gap-3">
        <View className="flex-row items-center gap-3">
          <Tile icon="Sparkles" tile="accent" tone="accent-ink" />
          {state.detail === undefined || onOpenDetail === undefined ? (
            words
          ) : (
            // The board draws the label and headline with a chevron as the one link to the detail, and the
            // accessible name is core's "See why" one.
            <Pressable
              aria-label={copy.linkName}
              className="min-h-touch-target min-w-0 flex-1 flex-row items-center gap-2"
              role="link"
              onPress={onOpenDetail}
            >
              {words}
              <Icon name="ChevronRight" size="sm" tone="muted" />
            </Pressable>
          )}
        </View>
        <Text>{copy.sentence}</Text>
        <View aria-label={copy.reasonsName} className="gap-1.5" role="list">
          {copy.reasons.map(({ kind, text }) => (
            <View key={text} accessible className="flex-row gap-2" role="listitem">
              <View
                className={`mt-[3px] h-2.5 w-2.5 shrink-0 rounded-[3px] ${reasonSwatchClassNames[kind]}`}
              />
              <Text className="min-w-0 flex-1" tone="secondary" variant="caption">
                {text}
              </Text>
            </View>
          ))}
        </View>
        <View className="flex-row gap-2">
          {state.accept === undefined ? null : (
            <Button className="flex-1" loading={state.isAccepting} size="sm" onPress={state.accept}>
              {copy.primaryAction}
            </Button>
          )}
          {onDismiss === undefined ? null : (
            <Button
              accessibilityLabel={copy.dismissActionName}
              size="sm"
              variant="ghost"
              onPress={() => {
                onDismiss(state.day);
              }}
            >
              {copy.dismissAction}
            </Button>
          )}
        </View>
      </View>
    </Card>
  );
}

function Statement({
  name,
  tile,
  title,
  body,
}: {
  name: string;
  tile: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Card aria-label={name} role="region">
      <View className="flex-row items-center gap-3">
        {tile}
        <View className="min-w-0 flex-1 gap-0.5">
          <Text variant="body-strong">{title}</Text>
          <Text tone="secondary" variant="caption">
            {body}
          </Text>
        </View>
      </View>
    </Card>
  );
}

/**
 * The suggestion card on the Train home in its four states, as the `suggestion · *` boards draw them: the
 * offer with the reasons behind it and its two buttons, the card once it is added to the day, the card that
 * says there is nothing to add, and the card for a user with no goal. Every word is core's, given in the
 * state. A button is drawn only when its handler is given, and the offer for today draws no Add, so no
 * control is dead. Only the offer opens the detail, through the board's See why link on its heading, and
 * only when it holds the detail. The accepted card, the nothing to add card and the no goal card have no
 * session to show (the accepted one is worded from the stored row, which the live suggestion may differ
 * from), and the boards draw no link on them.
 */
export function SuggestionCard({ state, onDismiss, onSetGoal, onOpenDetail }: SuggestionCardProps) {
  switch (state.status) {
    case "hidden":
      return null;
    case "offer":
      return <Offer state={state} onDismiss={onDismiss} onOpenDetail={onOpenDetail} />;
    case "accepted":
      return (
        <Statement
          body={state.copy.detail}
          name={state.copy.cardName}
          tile={<Tile icon="Check" tile="success" tone="success" />}
          title={state.copy.title}
        />
      );
    case "nothing":
      return (
        <Statement
          body={state.copy.body}
          name={state.copy.cardName}
          tile={<Tile icon="Target" tile="raised" tone="secondary" />}
          title={state.copy.title}
        />
      );
    case "no_goal":
      return (
        <Card aria-label={SUGGESTION_NO_GOAL.sectionName} role="region">
          <View className="gap-3">
            <View className="flex-row items-center gap-3">
              <Tile icon="Sparkles" tile="accent" tone="accent-ink" />
              <View className="min-w-0 flex-1 gap-0.5">
                <Text variant="body-strong">{SUGGESTION_NO_GOAL.title}</Text>
                <Text tone="secondary" variant="caption">
                  {SUGGESTION_NO_GOAL.body}
                </Text>
              </View>
            </View>
            {onSetGoal === undefined ? null : (
              <Button fullWidth size="sm" onPress={onSetGoal}>
                {SUGGESTION_NO_GOAL.action}
              </Button>
            )}
          </View>
        </Card>
      );
  }
}
