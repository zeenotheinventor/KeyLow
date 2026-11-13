"use client";

import { createContext, useContext } from "react";

/**
 * What the thread's entries need of the chat beyond their own data, so a later ticket that fills an entry's
 * folder reads it here and leaves `AssistantThread` alone.
 */
export type AssistantThreadActions = {
  /** The time zone the notices word times in. */
  timeZone: string;
  /** Whether a quick reply or a confirmation may be answered now. */
  canAnswer: boolean;
  /** Sends the words as your message, for a quick reply or a confirmation. */
  onAnswer: (words: string) => void;
  /** Sends the last message again, for a failed turn's Try again and for Ask again. */
  onSendAgain: () => void;
};

const noActions: AssistantThreadActions = {
  timeZone: "UTC",
  canAnswer: false,
  onAnswer: () => undefined,
  onSendAgain: () => undefined,
};

export const AssistantThreadContext = createContext<AssistantThreadActions>(noActions);

export function useAssistantThreadActions(): AssistantThreadActions {
  return useContext(AssistantThreadContext);
}
