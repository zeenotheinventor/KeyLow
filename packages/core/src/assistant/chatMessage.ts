import { replyWords } from "./replyText";

/** What a chat message's reading needs of its props: the kit's own props are assignable to it. */
export type ChatMessageReading = {
  role: "you" | "assistant";
  /** Who said it, as a screen reader hears it first, such as "You" or "Assistant". */
  speakerLabel: string;
  paragraphs: readonly string[];
  isStreaming?: boolean | undefined;
  stoppedLabel?: string | undefined;
  estimate?: { badgeLabel: string; label: string } | undefined;
  citation?: string | undefined;
};

/**
 * How the reader reads a paragraph: only the last one can be cut short, while the message arrives and on a
 * reply that was stopped. Only while it is still arriving does the reader hold back a line that starts with a
 * pipe, so a stopped reply shows every line it has.
 */
export function replyReadOptions({
  paragraphCount,
  index,
  isStreaming,
  isStopped,
}: {
  paragraphCount: number;
  index: number;
  isStreaming: boolean;
  isStopped: boolean;
}): { isPartial: boolean; isArriving: boolean } {
  const isLast = index === paragraphCount - 1;
  return { isPartial: (isStreaming || isStopped) && isLast, isArriving: isStreaming && isLast };
}

/**
 * What a screen reader hears: who said it first, then the words and the lines under them in the order the
 * message draws them, without the markers the assistant wrote. The caret is not in it, because it is only a mark.
 */
export function describeChatMessage(message: ChatMessageReading): string {
  const lines =
    message.role === "assistant"
      ? message.paragraphs
          .map((paragraph, index) =>
            replyWords(
              paragraph,
              replyReadOptions({
                paragraphCount: message.paragraphs.length,
                index,
                isStreaming: message.isStreaming === true,
                isStopped: message.stoppedLabel !== undefined,
              }),
            ),
          )
          .filter((words) => words !== "")
      : [...message.paragraphs];
  if (message.estimate !== undefined) {
    lines.push(`${message.estimate.badgeLabel} ${message.estimate.label}`);
  }
  if (message.citation !== undefined) {
    lines.push(message.citation);
  }
  if (message.stoppedLabel !== undefined) {
    lines.push(message.stoppedLabel);
  }
  return `${message.speakerLabel}: ${lines.join(" ")}`;
}
