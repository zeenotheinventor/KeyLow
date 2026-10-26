import { View } from "react-native";

import { Badge } from "../Badge";
import { Icon } from "../Icon";
import { Text } from "../Text";

import type { AssistantChatMessageProps, ChatMessageProps } from "./types";

// The board's caret: an 8 by 18 block in the accent, 2 points after the last word.
function Caret() {
  return <View aria-hidden className="ml-[2px] h-[18px] w-[8px] rounded-[1px] bg-accent" />;
}

// What a screen reader hears: who said it first, then the words and the lines under them in the order the
// message draws them. The caret is not in it, because it is only a mark.
function describeMessage(props: ChatMessageProps): string {
  const lines = [...props.paragraphs];
  if (props.estimate !== undefined) {
    lines.push(`${props.estimate.badgeLabel} ${props.estimate.label}`);
  }
  if (props.citation !== undefined) {
    lines.push(props.citation);
  }
  if (props.stoppedLabel !== undefined) {
    lines.push(props.stoppedLabel);
  }
  return `${props.speakerLabel}: ${lines.join(" ")}`;
}

// The words of a message are the same list of paragraphs in both, and the key is the position as well as
// the words because two paragraphs may repeat each other.
function Paragraphs({
  paragraphs,
  caretIndex,
}: {
  paragraphs: readonly string[];
  caretIndex?: number | undefined;
}) {
  return paragraphs.map((paragraph, index) => (
    <Text key={`${index}-${paragraph}`}>
      {paragraph}
      {index === caretIndex ? <Caret /> : null}
    </Text>
  ));
}

function AssistantLines({
  stoppedLabel,
  estimate,
  citation,
}: Pick<AssistantChatMessageProps, "stoppedLabel" | "estimate" | "citation">) {
  return (
    <>
      {estimate === undefined ? null : (
        <View className="flex-row items-center gap-2">
          <Badge outlined>{estimate.badgeLabel}</Badge>
          <Text className="shrink" tone="muted" variant="caption">
            {estimate.label}
          </Text>
        </View>
      )}
      {citation === undefined ? null : (
        <View className="flex-row items-center gap-[6px]">
          <Icon name="Database" size={14} tone="muted" />
          <Text className="shrink" tone="muted" variant="caption">
            {citation}
          </Text>
        </View>
      )}
      {stoppedLabel === undefined ? null : (
        <Text tone="muted" variant="caption">
          {stoppedLabel}
        </Text>
      )}
    </>
  );
}

/**
 * One message in the assistant's conversation: your words in a bubble on the right, or the assistant's as
 * plain paragraphs, with the caret while they arrive, the Estimate badge, the citation and the stopped line
 * under them. Every word comes in by prop, because the kit adds no copy. It is one group for a screen reader,
 * named for who said it, and a polite live region while it streams.
 */
export function ChatMessage(props: ChatMessageProps) {
  const accessibility = {
    accessible: true,
    role: "group",
    "aria-label": describeMessage(props),
  } as const;

  if (props.role === "you") {
    // The bubble is on the page background with a hairline border, and its bottom right corner is the small radius.
    return (
      <View
        {...accessibility}
        className="max-w-[288px] gap-2 self-end rounded-medium rounded-br-small border border-border bg-background px-[14px] py-[10px]"
      >
        <Paragraphs paragraphs={props.paragraphs} />
      </View>
    );
  }

  const { isStreaming = false } = props;
  return (
    <View {...accessibility} aria-live={isStreaming ? "polite" : undefined} className="gap-2 pr-4">
      <Paragraphs
        caretIndex={isStreaming ? props.paragraphs.length - 1 : undefined}
        paragraphs={props.paragraphs}
      />
      <AssistantLines
        citation={props.citation}
        estimate={props.estimate}
        stoppedLabel={props.stoppedLabel}
      />
    </View>
  );
}
