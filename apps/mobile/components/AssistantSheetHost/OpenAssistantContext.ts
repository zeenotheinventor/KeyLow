import { createContext, useContext } from "react";

import type { AssistantOpening } from "./types";

type AssistantOpener = { open: (opening: AssistantOpening) => void };

// Outside a host nothing opens, so a screen under test that is not about the assistant needs no host.
const noHost: AssistantOpener = {
  open: () => undefined,
};

export const OpenAssistantContext = createContext<AssistantOpener>(noHost);

/** What opens the assistant sheet, from the diary's button or from Describe in Log food. */
export function useOpenAssistant(): AssistantOpener["open"] {
  return useContext(OpenAssistantContext).open;
}
