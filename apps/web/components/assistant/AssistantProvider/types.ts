import type { AssistantOpenedFrom } from "@keylow/core";
import type { ReactNode, RefObject } from "react";

/** How the panel was opened: on which day, and from the Train pages when it was. */
export type AssistantOpening = {
  /** The day on view in the diary, or today in the profile's zone, `YYYY-MM-DD`. */
  localDate: string;
  /** The pages whose top bar opened the panel, when they were not the diary's. The Train pages ask about training. */
  from?: AssistantOpenedFrom | undefined;
};

export type AssistantControls = {
  isOpen: boolean;
  /** Null until the panel has been opened once. It is kept while the panel closes, so it does not change as it goes. */
  opening: AssistantOpening | null;
  /** Opens the panel on the day on view (today in the profile's zone away from the diary), from the Train pages when `from` says so. */
  open: (from?: AssistantOpenedFrom) => void;
  close: () => void;
  /** The top bar's Assistant button, which focus goes back to when the panel closes. */
  buttonRef: RefObject<HTMLButtonElement | null>;
};

export type AssistantProviderProps = { children: ReactNode };
