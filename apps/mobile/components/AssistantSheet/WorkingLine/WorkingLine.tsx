import { useHeldWords } from "@keylow/api-client";
import { WORKING_LINE_ANNOUNCEMENT_GAP_MS } from "@keylow/core";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, View } from "react-native";

import { LoadingMark } from "../../LoadingMark";
import { Text } from "../../ui";

import type { WorkingLineProps } from "./types";

// The one place the glyph is drawn.
function WorkingGlyph() {
  return <LoadingMark size={20} />;
}

/**
 * The line under your message while the assistant works with no words to show, as `assistant · working` and
 * `assistant · recipe-reading` draw it: the animated Ki-Lo logo and the words in the secondary caption,
 * from the left, on one line that ends in an ellipsis. Each step's words stay up for 700 ms before the next
 * replace them. It is a status, so focus reads the words it shows. It is not a live region, which would read
 * every step on Android and is ignored on iOS, so the words shown are announced once on mounting and after
 * that only when 5 seconds have passed since the last announcement. The words come in by prop, because the
 * line adds none of its own. A step that takes a while brings a `hint`, a second caption in the muted ink,
 * indented to the words, which appears once the step has gone on for the hint's time and is announced when it does.
 */
export function WorkingLine({ text, hint }: WorkingLineProps) {
  const words = useHeldWords(text);
  const lastAnnouncedAt = useRef<number | null>(null);
  const hintWords = hint?.words;
  const hintDelay = hint?.afterMilliseconds;
  // The hint that has been waited out, so a step with no hint, or another step, starts the wait again.
  const [elapsedHint, setElapsedHint] = useState<string | null>(null);
  const isHintShown = hintWords !== undefined && elapsedHint === hintWords;

  // The wait is counted from the step that has a hint, so it starts again for a later step of the same turn.
  useEffect(() => {
    if (hintWords === undefined || hintDelay === undefined) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setElapsedHint(hintWords);
      AccessibilityInfo.announceForAccessibility(hintWords);
    }, hintDelay);
    return () => {
      clearTimeout(timer);
      setElapsedHint(null);
    };
  }, [hintWords, hintDelay]);

  useEffect(() => {
    const now = Date.now();
    if (
      lastAnnouncedAt.current === null ||
      now - lastAnnouncedAt.current >= WORKING_LINE_ANNOUNCEMENT_GAP_MS
    ) {
      lastAnnouncedAt.current = now;
      AccessibilityInfo.announceForAccessibility(words);
    }
  }, [words]);

  return (
    <View accessible className="gap-[2px]" role="status">
      <View className="flex-row items-center gap-2">
        <WorkingGlyph />
        <Text
          className="shrink"
          ellipsizeMode="tail"
          numberOfLines={1}
          tone="secondary"
          variant="caption"
        >
          {words}
        </Text>
      </View>
      {isHintShown ? (
        // Indented to the words: the 20 point logo and the 8 point gap.
        <Text className="pl-7" tone="muted" variant="caption">
          {hintWords}
        </Text>
      ) : null}
    </View>
  );
}
