import { describeAssistantCard } from "@keylow/core";

import type { AssistantCardUndo } from "@keylow/api-client";
import type { AssistantCard } from "@keylow/core";

/**
 * A stand-in for `useAssistantCardUndo` in the tests that draw cards but are not about their Undo: the card
 * as sent, no workout in progress, and a press that does nothing. The hook calls its reads inside
 * `@keylow/api-client`, so they are not the test's to replace. The Undo itself is tested with the real hook
 * in assistantActionCards.test.tsx and assistantTrainingCards.test.tsx.
 */
export function mockAssistantCardUndo(card: AssistantCard): AssistantCardUndo {
  const look = describeAssistantCard(card);
  return { look, undoState: look.undo.state, undo: () => Promise.resolve() };
}
