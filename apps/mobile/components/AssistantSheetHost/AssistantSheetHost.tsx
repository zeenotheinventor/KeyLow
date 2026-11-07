import { useCallback, useMemo, useState } from "react";

import { AssistantSheet } from "../AssistantSheet";
import { OpenAssistantContext } from "./OpenAssistantContext";

import type { AssistantOpening, AssistantSheetHostProps } from "./types";

/**
 * Holds the assistant sheet's open state, so every way into the assistant (the diary's button, the Train
 * header's and Describe in Log food) opens the same sheet through `useOpenAssistant()`. The sheet starts when it is first opened and
 * stays mounted from then on, so a stream that was stopped by closing the sheet is still there, marked
 * stopped, when it is opened again. It draws after what it hosts, so it covers it.
 */
export function AssistantSheetHost({ children }: AssistantSheetHostProps) {
  // The last way the sheet was opened is kept while it closes, so it does not change as it goes down.
  const [opening, setOpening] = useState<AssistantOpening | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback((next: AssistantOpening) => {
    setOpening(next);
    setIsOpen(true);
  }, []);
  const close = useCallback(() => {
    setIsOpen(false);
  }, []);
  const opener = useMemo(() => ({ open }), [open]);

  return (
    <OpenAssistantContext value={opener}>
      {children}
      {opening === null ? null : (
        <AssistantSheet
          describeAt={opening.describeAt}
          from={opening.from}
          localDate={opening.localDate}
          open={isOpen}
          onClose={close}
        />
      )}
    </OpenAssistantContext>
  );
}
