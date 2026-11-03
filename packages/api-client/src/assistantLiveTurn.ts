import type { AssistantCard, AssistantNotice, AssistantStreamEvent } from "@keylow/core";

type EventOfType<Type extends AssistantStreamEvent["type"]> = Omit<
  Extract<AssistantStreamEvent, { type: Type }>,
  "type"
>;

/**
 * The turn being written, as the assistant sheet draws it. Each field is what one board shows:
 * `text` grows with the reply (`assistant · streaming`), `cards` are the writes with their Undo, `clarify`
 * and `confirm` end the turn with a question, `answerMeta` sits under an answer, `status` is the recipe
 * page being read, `notice` is a gate or a failure, and `stopped` is set when the person closed the sheet
 * before the end. `outcome` is how the turn ended, null while it is still going or when it was stopped.
 */
export type AssistantLiveTurn = {
  turnId: string | null;
  conversationId: string | null;
  text: string;
  cards: AssistantCard[];
  clarify: EventOfType<"clarify"> | null;
  confirm: EventOfType<"confirm"> | null;
  answerMeta: EventOfType<"answer_meta"> | null;
  status: EventOfType<"status"> | null;
  notice: AssistantNotice | null;
  stopped: boolean;
  outcome: EventOfType<"done">["outcome"] | null;
};

export function newLiveTurn(): AssistantLiveTurn {
  return {
    turnId: null,
    conversationId: null,
    text: "",
    cards: [],
    clarify: null,
    confirm: null,
    answerMeta: null,
    status: null,
    notice: null,
    stopped: false,
    outcome: null,
  };
}

/** Folds one event of the stream into the turn. */
export function applyAssistantEvent(
  live: AssistantLiveTurn,
  event: AssistantStreamEvent,
): AssistantLiveTurn {
  switch (event.type) {
    case "turn":
      return { ...live, turnId: event.turnId, conversationId: event.conversationId };
    case "status":
      return { ...live, status: { code: event.code, host: event.host } };
    // The recipe page is read before the reply, so anything else arriving means the reading is over.
    case "text":
      return { ...live, status: null, text: live.text + event.delta };
    case "card":
      return { ...live, status: null, cards: [...live.cards, event.card] };
    case "clarify":
      return {
        ...live,
        status: null,
        clarify: {
          question: event.question,
          quickReplies: event.quickReplies,
          fieldHint: event.fieldHint,
        },
      };
    case "confirm":
      return {
        ...live,
        status: null,
        confirm: {
          confirmationId: event.confirmationId,
          question: event.question,
          confirmLabel: event.confirmLabel,
          cancelLabel: event.cancelLabel,
          tone: event.tone,
        },
      };
    case "answer_meta":
      return {
        ...live,
        status: null,
        answerMeta: { citation: event.citation, estimate: event.estimate },
      };
    case "notice":
      return { ...live, status: null, notice: event.notice };
    case "done":
      return { ...live, status: null, outcome: event.outcome };
  }
}

/** The turn after the person stopped it: what arrived stays, marked stopped. */
export function stoppedTurn(live: AssistantLiveTurn): AssistantLiveTurn {
  return { ...live, status: null, stopped: true };
}

/**
 * The turn after it broke off (a network failure, an event the app cannot read): what arrived stays,
 * including a notice, so a day limit followed by a dropped connection still shows the day limit.
 */
export function failedTurn(live: AssistantLiveTurn): AssistantLiveTurn {
  return {
    ...live,
    status: null,
    notice: live.notice ?? { code: "turn_failed" },
    outcome: "failed",
  };
}
