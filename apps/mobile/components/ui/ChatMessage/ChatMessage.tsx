import { parseReplyText, replyWords } from "@keylow/core";
import { Fragment } from "react";
import { View } from "react-native";

import { Badge } from "../Badge";
import { Icon } from "../Icon";
import { Text } from "../Text";

import type { AssistantChatMessageProps, ChatMessageProps } from "./types";
import type { ReplyBlock, ReplySpan } from "@keylow/core";

// The board's caret: an 8 by 18 block in the accent, 2 points after the last word.
function Caret() {
  return <View aria-hidden className="ml-[2px] h-[18px] w-[8px] rounded-[1px] bg-accent" />;
}

// Only the last paragraph can be cut short: while the message arrives, and on a reply that was stopped.
function isPartialAt(props: AssistantChatMessageProps, index: number): boolean {
  return (
    (props.isStreaming === true || props.stoppedLabel !== undefined) &&
    index === props.paragraphs.length - 1
  );
}

// What a screen reader hears: who said it first, then the words and the lines under them in the order the
// message draws them, without the markers the assistant wrote. The caret is not in it, because it is only a mark.
function describeMessage(props: ChatMessageProps): string {
  const lines =
    props.role === "assistant"
      ? props.paragraphs
          .map((paragraph, index) =>
            replyWords(paragraph, { isPartial: isPartialAt(props, index) }),
          )
          .filter((words) => words !== "")
      : [...props.paragraphs];
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

// Your words are plain text, never read as markdown. The key is the position as well as the words because
// two paragraphs may repeat each other.
function YourParagraphs({ paragraphs }: { paragraphs: readonly string[] }) {
  return paragraphs.map((paragraph, index) => (
    <Text key={`${index}-${paragraph}`}>{paragraph}</Text>
  ));
}

// Italic is the `italic` class on Geist Regular, because the app bundles no italic face, and code stays in
// Geist, because it bundles no mono face. A span with no style is plain words. In a heading every span keeps
// the strong look, so emphasis inside it does not lose its weight.
function Spans({ spans, isHeading }: { spans: readonly ReplySpan[]; isHeading: boolean }) {
  return spans.map((span, index) => (
    <Fragment key={index}>
      {span.isStrong || span.isEmphasis ? (
        <Text
          className={span.isEmphasis ? "italic" : ""}
          variant={span.isStrong || isHeading ? "body-strong" : "body"}
        >
          {span.text}
        </Text>
      ) : (
        span.text
      )}
    </Fragment>
  ));
}

// An item is its marker in a 20 point column and then its words, which wrap under themselves.
function ReplyBlockView({ block, hasCaret }: { block: ReplyBlock; hasCaret: boolean }) {
  const words = (
    <>
      <Spans isHeading={block.kind === "heading"} spans={block.spans} />
      {hasCaret ? <Caret /> : null}
    </>
  );
  if (block.kind !== "item") {
    return <Text variant={block.kind === "heading" ? "body-strong" : "body"}>{words}</Text>;
  }
  return (
    <View className={block.depth === 1 ? "flex-row items-start pl-[20px]" : "flex-row items-start"}>
      <Text className="min-w-[20px] shrink-0" tone="secondary">
        {block.number === null ? "•" : `${block.number}.`}
      </Text>
      <Text className="flex-1">{words}</Text>
    </View>
  );
}

// The assistant's paragraphs as the blocks they hold, one after the other with the paragraphs' gap. A paragraph
// that holds no words yet draws nothing, so the caret goes after the last block that does draw, and stands
// alone when nothing does. Blocks are keyed by position, because the last paragraph's words change on every
// chunk and a key holding them would mount it again.
function FormattedParagraphs({
  props,
  hasCaret,
}: {
  props: AssistantChatMessageProps;
  hasCaret: boolean;
}) {
  const blocks = props.paragraphs.flatMap((paragraph, paragraphIndex) =>
    parseReplyText(paragraph, { isPartial: isPartialAt(props, paragraphIndex) }).map(
      (block, blockIndex) => ({ key: `${paragraphIndex}-${blockIndex}`, block }),
    ),
  );
  if (blocks.length === 0) {
    return hasCaret ? (
      <Text>
        <Caret />
      </Text>
    ) : null;
  }
  return blocks.map(({ key, block }, index) => (
    <ReplyBlockView block={block} hasCaret={hasCaret && index === blocks.length - 1} key={key} />
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
 * paragraphs with its markdown drawn as formatting (bold, italic, headings, bullets and numbers, and the
 * words of a link, which is never tappable), with the caret while they arrive, the Estimate badge, the
 * citation and the stopped line under them. Every word comes in by prop, because the kit adds no copy. It is
 * one group for a screen reader, named for who said it. It is not a live region while it streams, because
 * Android would read the whole text again for every chunk and iOS ignores a live region, so the screen
 * announces a finished answer itself.
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
        <YourParagraphs paragraphs={props.paragraphs} />
      </View>
    );
  }

  const { isStreaming = false } = props;
  return (
    <View {...accessibility} className="gap-2 pr-4">
      <FormattedParagraphs hasCaret={isStreaming} props={props} />
      <AssistantLines
        citation={props.citation}
        estimate={props.estimate}
        stoppedLabel={props.stoppedLabel}
      />
    </View>
  );
}
