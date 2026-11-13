"use client";

import { createContext, createRef, useContext } from "react";

import type { AssistantControls } from "./types";

// Outside a provider nothing opens, so a screen under test that is not about the assistant needs no provider.
const noProvider: AssistantControls = {
  isOpen: false,
  opening: null,
  open: () => undefined,
  describe: () => undefined,
  close: () => undefined,
  buttonRef: createRef<HTMLButtonElement>(),
};

export const AssistantContext = createContext<AssistantControls>(noProvider);

/** The assistant panel's open state and the top bar's button, for the button and the panel. */
export function useAssistant(): AssistantControls {
  return useContext(AssistantContext);
}

/** What opens the assistant panel, from the top bar's button. */
export function useOpenAssistant(): AssistantControls["open"] {
  return useContext(AssistantContext).open;
}
