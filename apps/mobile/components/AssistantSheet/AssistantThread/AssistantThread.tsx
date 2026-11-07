import { ASSISTANT_SHEET, ASSISTANT_STOPPED, describeAssistantNotice } from "@keylow/core/copy";

import { AssistantLinkRow, AssistantNotice, ChatMessage, ChipGroup } from "../../ui";
import { AssistantCardEntry } from "../AssistantCardEntry";
import { ConfirmButtons } from "../ConfirmButtons";
import { WorkingLine } from "../WorkingLine";

import type { AssistantThreadProps } from "./types";
import type { AssistantNoticeTone, IconName } from "../../ui";
import type { AssistantSheetEntry } from "@keylow/core";

// Each notice has its board's glyph. The failed turn is the one with the danger tone.
const noticeLooks: Record<
  Extract<AssistantSheetEntry, { kind: "notice" }>["notice"]["code"],
  { icon: IconName; tone: AssistantNoticeTone }
> = {
  day_limit: { icon: "Clock", tone: "neutral" },
  plus: { icon: "Lock", tone: "neutral" },
  resting: { icon: "Moon", tone: "neutral" },
  switched_off: { icon: "PowerOff", tone: "neutral" },
  turn_failed: { icon: "CircleAlert", tone: "danger" },
};

const askAgainOptions = [{ value: "ask-again", label: ASSISTANT_STOPPED.askAgain }];

/**
 * The messages and action cards of the conversation, oldest first, with the quick reply under an answer
 * that was cut short or that asked for it, the quick replies under a clarifying question, the two buttons under a
 * confirmation, the citation and Estimate lines under an answer from the person's data, a link on its own
 * under an answer that made no card, and the working line while the assistant works with no words to show.
 * Every word comes from the thread the screen was given or from core's copy, so nothing here words a
 * message, and nothing in it decides what to show.
 */
export function AssistantThread({
  thread,
  timeZone,
  onTryAgain,
  onAskAgain,
  onOpenCardLink,
  canAnswer,
  onAnswer,
}: AssistantThreadProps) {
  function renderEntry(entry: AssistantSheetEntry) {
    switch (entry.kind) {
      case "you":
        return (
          <ChatMessage
            key={entry.key}
            paragraphs={[entry.text]}
            role="you"
            speakerLabel={ASSISTANT_SHEET.speakerYou}
          />
        );
      case "card":
        return <AssistantCardEntry card={entry.card} key={entry.key} onOpenLink={onOpenCardLink} />;
      case "link":
        return (
          <AssistantLinkRow
            isStandalone
            key={entry.key}
            label={entry.link.label}
            onPress={() => {
              onOpenCardLink(entry.link.target);
            }}
          />
        );
      // Ask again is the chip at the end of the thread, drawn once below.
      case "askAgain":
        return null;
      case "assistant":
        return (
          <ChatMessage
            isStreaming={entry.isStreaming}
            key={entry.key}
            paragraphs={entry.paragraphs}
            role="assistant"
            speakerLabel={ASSISTANT_SHEET.speakerAssistant}
            stoppedLabel={entry.isStopped ? ASSISTANT_STOPPED.label : undefined}
            citation={entry.citation ?? undefined}
            estimate={entry.estimate ?? undefined}
          />
        );
      case "status":
        return <WorkingLine key={entry.key} text={entry.text} />;
      case "quickReplies":
        return (
          <ChipGroup
            disabled={!canAnswer}
            key={entry.key}
            label={ASSISTANT_SHEET.quickRepliesLabel}
            layout="wrap"
            options={entry.options.map((reply) => ({ value: reply, label: reply }))}
            selection="action"
            onChipPress={onAnswer}
          />
        );
      case "confirm":
        return (
          <ConfirmButtons
            cancelLabel={entry.cancelLabel}
            confirmLabel={entry.confirmLabel}
            isDisabled={!canAnswer}
            key={entry.key}
            tone={entry.tone}
            onAnswer={onAnswer}
          />
        );
      case "notice": {
        const words = describeAssistantNotice(entry.notice, timeZone);
        const look = noticeLooks[entry.notice.code];
        return (
          <AssistantNotice
            buttons={
              entry.isLatest && words.button !== null
                ? [{ label: words.button, kind: "secondary", onPress: onTryAgain }]
                : []
            }
            icon={look.icon}
            key={entry.key}
            paragraphs={[words.body]}
            title={words.title}
            tone={look.tone}
          />
        );
      }
    }
  }

  return (
    <>
      {thread.entries.map(renderEntry)}
      {thread.canAskAgain ? (
        <ChipGroup
          label={ASSISTANT_SHEET.quickRepliesLabel}
          layout="wrap"
          options={askAgainOptions}
          selection="action"
          onChipPress={onAskAgain}
        />
      ) : null}
    </>
  );
}
