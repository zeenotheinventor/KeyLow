import { describeTurnEndedAfterWrite } from "@keylow/core";

import type {
  AssistantCard,
  AssistantCardLink,
  AssistantExerciseFormMedia,
  AssistantExerciseMuscles,
  AssistantNotice,
  AssistantStatus,
  AssistantStreamEvent,
} from "@keylow/core";

type EventOfType<Type extends AssistantStreamEvent["type"]> = Omit<
  Extract<AssistantStreamEvent, { type: Type }>,
  "type"
>;

/**
 * The turn being written, as the assistant sheet draws it. Each field is what one board shows:
 * `text` grows with the reply (`assistant · streaming`), `cards` are the writes with their Undo, `clarify`
 * and `confirm` end the turn with a question, `answerMeta` sits under an answer, `status` is the step the
 * assistant is on, `notice` is a gate or a failure, and `stopped` is set when the person closed the sheet
 * before the end. `exerciseMuscles` are the muscles of each exercise the turn showed, and `exerciseFormMedia` the form video or photos of each, both in call order. `link` is a
 * link that arrived on its own, and `askAgain` whether the turn offered the Ask
 * again quick reply. `outcome` is how the turn ended, null while it is still going or when it was stopped.
 */
export type AssistantLiveTurn = {
  turnId: string | null;
  conversationId: string | null;
  text: string;
  cards: AssistantCard[];
  clarify: EventOfType<"clarify"> | null;
  confirm: EventOfType<"confirm"> | null;
  answerMeta: EventOfType<"answer_meta"> | null;
  exerciseMuscles: AssistantExerciseMuscles[];
  exerciseFormMedia: AssistantExerciseFormMedia[];
  link: AssistantCardLink | null;
  askAgain: boolean;
  status: AssistantStatus | null;
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
    exerciseMuscles: [],
    exerciseFormMedia: [],
    link: null,
    askAgain: false,
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
    case "status": {
      // The fields are copied whole, so a new status field needs nothing here.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { type, ...status } = event;
      return { ...live, status };
    }
    // A step comes before the reply, so anything else arriving means the step is over.
    case "text":
      return { ...live, status: null, text: live.text + event.delta };
    case "card":
      return { ...live, status: null, cards: [...live.cards, event.card] };
    case "exercise_muscles":
      return { ...live, status: null, exerciseMuscles: [...live.exerciseMuscles, event.exercise] };
    case "exercise_form_media":
      return {
        ...live,
        status: null,
        exerciseFormMedia: [...live.exerciseFormMedia, event.exercise],
      };
    // Nothing draws a recipe draft yet (the kitchen screens come later), so it only ends the step.
    case "recipe_draft":
      return { ...live, status: null };
    case "link":
      return { ...live, status: null, link: event.link };
    case "ask_again":
      return { ...live, status: null, askAgain: true };
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

/**
 * The turn with the words for a saved change at the end of its reply, when it has drawn a card. A write has
 * landed by then, and "Nothing was changed", Try again and Ask again would all send the message again and could
 * repeat it (KEY-926). Null when no card was drawn. The reply is left as it is when it already ends in those words,
 * which the server sends itself before a stream that breaks just before `done`. The writes are the action ids of
 * the cards, because a card groups the writes of one kind that came together.
 */
function endedInSavedWords(live: AssistantLiveTurn): AssistantLiveTurn | null {
  if (live.cards.length === 0) {
    return null;
  }
  const writes = live.cards.reduce((count, card) => count + card.actionIds.length, 0);
  const words = describeTurnEndedAfterWrite(writes);
  const text = live.text.trimEnd();
  const alreadyEnds = [1, 2].some((count) => text.endsWith(describeTurnEndedAfterWrite(count)));
  return {
    ...live,
    status: null,
    text: alreadyEnds ? live.text : text === "" ? words : `${live.text}\n\n${words}`,
  };
}

/**
 * The turn after the person stopped it: what arrived stays, marked stopped. A turn that has drawn a card is
 * not marked stopped but ends in the words for a saved change, with no outcome (a stop has none), so Ask again
 * is not offered. Nobody is waiting for those words, so the sheet does not read them aloud.
 */
export function stoppedTurn(live: AssistantLiveTurn): AssistantLiveTurn {
  const saved = endedInSavedWords(live);
  return saved === null ? { ...live, status: null, stopped: true } : saved;
}

/**
 * The turn after it broke off (a network failure, an event the app cannot read): what arrived stays,
 * including a notice, so a day limit followed by a dropped connection still shows the day limit. A turn
 * that has drawn a card ends in the words for a saved change instead of the failed-turn notice, as the
 * server's own ending does. It is best effort: a write whose card never arrived still shows the notice
 * until the conversation is read again.
 */
export function failedTurn(live: AssistantLiveTurn): AssistantLiveTurn {
  const saved = endedInSavedWords(live);
  return saved === null
    ? { ...live, status: null, notice: live.notice ?? { code: "turn_failed" }, outcome: "failed" }
    : { ...saved, outcome: "failed" };
}
