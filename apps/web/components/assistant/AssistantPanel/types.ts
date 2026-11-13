import type { AssistantOpenedFrom } from "@keylow/core";
import type { RefObject } from "react";

export type AssistantPanelProps = {
  isOpen: boolean;
  /** Called after a close of any kind (the Close button, Escape), once a streaming answer was stopped. */
  onClose: () => void;
  /** The day the panel was opened on, `YYYY-MM-DD` in the person's time zone. The assistant logs to it when they name no other. */
  localDate: string;
  /** The pages whose top bar opened the panel, when they were not the diary's. The Train pages ask about training. */
  from?: AssistantOpenedFrom | undefined;
  /** The top bar's Assistant button, which focus is not taken from when the panel opens. */
  buttonRef: RefObject<HTMLButtonElement | null>;
  /** Docked, how far from the top of the window the panel starts: the bottom of the top bar while it shows, and 0 once the page has scrolled past it. */
  topOffset: number;
};
