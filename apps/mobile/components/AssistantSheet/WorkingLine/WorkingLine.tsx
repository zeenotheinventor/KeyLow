import { useEffect, useRef } from "react";
import { AccessibilityInfo, View } from "react-native";

import { useHeldWords } from "./useHeldWords";
import { SpinningGlyph } from "../../SpinningGlyph";
import { Icon, Text } from "../../ui";

import type { WorkingLineProps } from "./types";

/** A screen reader hears the line once, then again only if this long has passed, so a run of steps is not chatter. */
const ANNOUNCEMENT_GAP_MS = 5000;

// The one place the glyph is drawn, so the animated logo swaps this and nothing else.
function WorkingGlyph() {
  return (
    <SpinningGlyph>
      <Icon name="LoaderCircle" size={16} tone="accent-ink" />
    </SpinningGlyph>
  );
}

/**
 * The line under your message while the assistant works with no words to show, as `assistant · working` and
 * `assistant · recipe-reading` draw it: a turning ring in the accent and the words in the secondary caption,
 * from the left, on one line that ends in an ellipsis. Each step's words stay up for 700 ms before the next
 * replace them. It is a status, so focus reads the words it shows. It is not a live region, which would read
 * every step on Android and is ignored on iOS, so the words shown are announced once on mounting and after
 * that only when 5 seconds have passed since the last announcement. The words come in by prop, because the
 * line adds none of its own.
 */
export function WorkingLine({ text }: WorkingLineProps) {
  const words = useHeldWords(text);
  const lastAnnouncedAt = useRef<number | null>(null);

  useEffect(() => {
    const now = Date.now();
    if (lastAnnouncedAt.current === null || now - lastAnnouncedAt.current >= ANNOUNCEMENT_GAP_MS) {
      lastAnnouncedAt.current = now;
      AccessibilityInfo.announceForAccessibility(words);
    }
  }, [words]);

  return (
    <View accessible className="flex-row items-center gap-2" role="status">
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
  );
}
