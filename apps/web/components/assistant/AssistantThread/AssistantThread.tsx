import { ASSISTANT_SHEET, ASSISTANT_STOPPED } from "@keylow/core/copy";

import { AskAgain } from "../AskAgain";
import { CardEntry } from "../CardEntry";
import { ConfirmEntry } from "../ConfirmEntry";
import { ExerciseFormEntry } from "../ExerciseFormEntry";
import { ExerciseMusclesEntry } from "../ExerciseMusclesEntry";
import { LinkEntry } from "../LinkEntry";
import { NoticeEntry } from "../NoticeEntry";
import { QuickRepliesEntry } from "../QuickRepliesEntry";
import { WorkingLine } from "../WorkingLine";

import type { AssistantThreadProps } from "./types";
import type { AssistantSheetEntry } from "@keylow/core";

import { ChatMessage } from "@/components/ui/ChatMessage";

function renderEntry(entry: AssistantSheetEntry) {
  switch (entry.kind) {
    case "you":
      return (
        <ChatMessage
          key={entry.key}
          paragraphs={[entry.text]}
          sender="you"
          speakerLabel={ASSISTANT_SHEET.speakerYou}
        />
      );
    case "assistant":
      return (
        <ChatMessage
          key={entry.key}
          citation={entry.citation ?? undefined}
          estimate={entry.estimate ?? undefined}
          isStreaming={entry.isStreaming}
          paragraphs={entry.paragraphs}
          sender="assistant"
          speakerLabel={ASSISTANT_SHEET.speakerAssistant}
          stoppedLabel={entry.isStopped ? ASSISTANT_STOPPED.label : undefined}
        />
      );
    case "status":
      return <WorkingLine key={entry.key} text={entry.text} />;
    case "notice":
      return <NoticeEntry key={entry.key} entry={entry} />;
    case "card":
      return <CardEntry key={entry.key} entry={entry} />;
    case "link":
      return <LinkEntry key={entry.key} entry={entry} />;
    case "quickReplies":
      return <QuickRepliesEntry key={entry.key} entry={entry} />;
    case "confirm":
      return <ConfirmEntry key={entry.key} entry={entry} />;
    case "exerciseMuscles":
      return <ExerciseMusclesEntry key={entry.key} entry={entry} />;
    case "exerciseFormMedia":
      return <ExerciseFormEntry key={entry.key} entry={entry} />;
    // Ask again is the quick reply at the end of the thread, drawn once below.
    case "askAgain":
      return null;
  }
}

/**
 * The messages of the conversation, oldest first, and the working line while the assistant works with no
 * words to show. Every kind of entry has its own component in its own folder, so a later ticket fills one
 * folder and never edits this file. Until then the notice, card, link, quick replies, confirmation and the
 * two exercise cards draw nothing, and the reply's words still show. Every word comes from the thread
 * or from core's copy, and nothing here decides what to show.
 */
export function AssistantThread({ thread }: AssistantThreadProps) {
  return (
    <>
      {thread.entries.map(renderEntry)}
      <AskAgain canAskAgain={thread.canAskAgain} />
    </>
  );
}
