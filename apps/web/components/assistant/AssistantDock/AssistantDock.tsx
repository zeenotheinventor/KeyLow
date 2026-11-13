"use client";

import { useRef } from "react";

import { useVisibleTopBarBottom } from "./useVisibleTopBarBottom";

import type { AssistantDockProps } from "./types";

import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { useAssistant } from "@/components/assistant/AssistantProvider";
import { cn } from "@/lib/utils";

// The panel is 400 px wide from the large breakpoint, so the page leaves that room beside it while it is open.
const roomForPanel = "lg:mr-[400px]";

/**
 * The page and the assistant panel beside it. The panel starts when it is first opened and stays mounted
 * from then on, so a stream that was stopped by closing it is still there when it opens again. From the
 * large breakpoint it is docked on the right and the page narrows beside it, and below it, it covers the page.
 */
export function AssistantDock({ children }: AssistantDockProps) {
  const { isOpen, opening, close, buttonRef } = useAssistant();
  const pageRef = useRef<HTMLDivElement>(null);
  const topOffset = useVisibleTopBarBottom(pageRef, isOpen);

  return (
    <>
      <div ref={pageRef} className={cn(isOpen && roomForPanel)}>
        {children}
      </div>
      {opening === null ? null : (
        <AssistantPanel
          buttonRef={buttonRef}
          describeAt={opening.describeAt}
          from={opening.from}
          isOpen={isOpen}
          localDate={opening.localDate}
          topOffset={topOffset}
          onClose={close}
        />
      )}
    </>
  );
}
