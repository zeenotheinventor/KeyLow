"use client";

import { useHeldWords } from "@keylow/api-client";
import { WORKING_LINE_ANNOUNCEMENT_GAP_MS } from "@keylow/core";
import { useEffect, useRef, useState } from "react";

import type { WorkingLineProps } from "./types";

import { KiLoMark } from "@/components/ui/KiLoMark";

/**
 * The line under your message while the assistant works with no words to show (`assistant · working`): the
 * animated Ki-Lo logo at 20 px (still under reduced motion) and then the words in the secondary caption, on
 * one line that ends in an ellipsis. Each step's words stay up for 700 ms before the next replace them. The
 * line is a status that is not live, which would read every step, so a hidden polite note beside it is
 * written once on mounting and after that only when 5 seconds have passed since the last time.
 */
export function WorkingLine({ text }: WorkingLineProps) {
  const words = useHeldWords(text);
  const lastAnnouncedAt = useRef<number | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const now = Date.now();
    if (
      lastAnnouncedAt.current === null ||
      now - lastAnnouncedAt.current >= WORKING_LINE_ANNOUNCEMENT_GAP_MS
    ) {
      lastAnnouncedAt.current = now;
      setAnnouncement(words);
    }
  }, [words]);

  return (
    <>
      <div role="status" aria-live="off" className="flex items-center gap-2">
        <KiLoMark isAnimated className="size-5" />
        <span className="truncate text-caption text-text-secondary">{words}</span>
      </div>
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </>
  );
}
