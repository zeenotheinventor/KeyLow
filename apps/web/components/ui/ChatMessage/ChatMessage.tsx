import { describeChatMessage, parseReplyText, replyReadOptions, tableOpening } from "@keylow/core";
import { iconStroke } from "@keylow/tokens";
import { Database } from "lucide-react";

import type { AssistantChatMessageProps, ChatMessageProps } from "./types";
import type { ReplyBlock } from "@keylow/core";

import { Badge } from "@/components/ui/Badge";
import { ReplySpans, ReplyTable } from "@/components/ui/ReplyTable";

// The board's caret: an 8 by 18 block in the accent, 2 px after the last word. It is only a mark.
function Caret() {
  return (
    <span
      aria-hidden
      className="ml-[2px] inline-block h-[18px] w-[8px] rounded-[1px] bg-accent align-[-3px]"
    />
  );
}

// A table is wider than the words around it, so it takes back the reply's 16 px on its right itself. While
// the reply arrives and the table is its last line, the caret waits in an empty row under the last one, and
// once words follow, it goes back to the end of those words.
function ReplyBlockView({
  block,
  hasCaret,
  isHidden,
}: {
  block: ReplyBlock;
  hasCaret: boolean;
  isHidden: boolean;
}) {
  if (block.kind === "table") {
    return (
      <ReplyTable
        label={tableOpening(block)}
        pendingMark={hasCaret && block.isOpen ? <Caret /> : undefined}
        table={block}
      />
    );
  }
  const hidden = isHidden ? { "aria-hidden": true } : {};
  const words = (
    <>
      <ReplySpans spans={block.spans} />
      {hasCaret ? <Caret /> : null}
    </>
  );
  if (block.kind !== "item") {
    return (
      <p {...hidden} className={block.kind === "heading" ? "text-body-strong" : undefined}>
        {words}
      </p>
    );
  }
  // An item is its marker in a column of at least 20 px and then its words, which wrap under themselves.
  return (
    <div {...hidden} className={block.depth === 1 ? "flex items-start pl-5" : "flex items-start"}>
      <span className="min-w-5 shrink-0 text-text-secondary">
        {block.number === null ? "•" : `${block.number}.`}
      </span>
      <p className="min-w-0 flex-1">{words}</p>
    </div>
  );
}

// The assistant's paragraphs as the blocks they hold. Blocks are keyed by position, because the last
// paragraph's words change on every chunk and a key holding them would mount it again.
function keyedBlocks(message: AssistantChatMessageProps) {
  return message.paragraphs.flatMap((paragraph, paragraphIndex) =>
    parseReplyText(
      paragraph,
      replyReadOptions({
        paragraphCount: message.paragraphs.length,
        index: paragraphIndex,
        isStreaming: message.isStreaming === true,
        isStopped: message.stoppedLabel !== undefined,
      }),
    ).map((block, blockIndex) => ({ key: `${paragraphIndex}-${blockIndex}`, block })),
  );
}

type KeyedBlocks = ReturnType<typeof keyedBlocks>;

function hasTableBlock(blocks: KeyedBlocks): boolean {
  return blocks.some(({ block }) => block.kind === "table");
}

function FormattedParagraphs({ blocks, hasCaret }: { blocks: KeyedBlocks; hasCaret: boolean }) {
  if (blocks.length === 0) {
    return hasCaret ? (
      <p>
        <Caret />
      </p>
    ) : null;
  }
  // The message's name reads a table's words, so the words around it are hidden while the table's scroll
  // region is not, and a screen reader hears each of them once.
  const hasTable = hasTableBlock(blocks);
  return blocks.map(({ key, block }, index) => (
    <ReplyBlockView
      key={key}
      block={block}
      hasCaret={hasCaret && index === blocks.length - 1}
      isHidden={hasTable}
    />
  ));
}

// With a table in the message these lines are in the group's name already, so they are hidden from a
// screen reader as the words around the table are, and `contents` keeps them in the message's flow.
function AssistantLines({
  stoppedLabel,
  estimate,
  citation,
  isHidden,
}: Pick<AssistantChatMessageProps, "stoppedLabel" | "estimate" | "citation"> & {
  isHidden: boolean;
}) {
  return (
    <div {...(isHidden ? { "aria-hidden": true } : {})} className="contents">
      {estimate === undefined ? null : (
        <div className="flex items-center gap-2">
          <Badge outlined>{estimate.badgeLabel}</Badge>
          <span className="min-w-0 text-caption text-text-muted">{estimate.label}</span>
        </div>
      )}
      {citation === undefined ? null : (
        <div className="flex items-center gap-[6px] text-text-muted">
          <Database aria-hidden className="size-[14px] shrink-0" strokeWidth={iconStroke} />
          <span className="min-w-0 text-caption">{citation}</span>
        </div>
      )}
      {stoppedLabel === undefined ? null : (
        <span className="text-caption text-text-muted">{stoppedLabel}</span>
      )}
    </div>
  );
}

/**
 * One message in the assistant's conversation: your words in a bubble on the right, or the assistant's as
 * paragraphs with its markdown drawn as formatting (bold, italic, headings, bullets and numbers, and the
 * words of a link, which is never a link), with the caret while they arrive, the Estimate badge, the
 * citation and the stopped line under them. Every
 * word comes in by prop, because the kit adds no copy. It is one group for a screen reader, named for who
 * said it. It is not a live region while it streams, because a screen reader would read the whole text again
 * for every chunk, so the panel announces a finished answer itself.
 */
export function ChatMessage(props: ChatMessageProps) {
  // The kit names the prop `sender`, because `role` is an ARIA attribute and the lint rule reads it as one.
  const name = describeChatMessage({ ...props, role: props.sender });

  if (props.sender === "you") {
    // The bubble is on the page background with a hairline border, and its bottom right corner is the small radius.
    return (
      <div
        role="group"
        aria-label={name}
        className="flex max-w-[288px] flex-col gap-2 self-end break-words rounded-medium rounded-br-small border border-border bg-background px-[14px] py-[10px] text-body"
      >
        {props.paragraphs.map((paragraph, index) => (
          <p key={`${index}-${paragraph}`} className="whitespace-pre-wrap">
            {paragraph}
          </p>
        ))}
      </div>
    );
  }

  const { isStreaming = false } = props;
  const blocks = keyedBlocks(props);
  return (
    <div role="group" aria-label={name} className="flex flex-col gap-2 pr-4 text-body">
      <FormattedParagraphs blocks={blocks} hasCaret={isStreaming} />
      <AssistantLines
        citation={props.citation}
        estimate={props.estimate}
        isHidden={hasTableBlock(blocks)}
        stoppedLabel={props.stoppedLabel}
      />
    </div>
  );
}
