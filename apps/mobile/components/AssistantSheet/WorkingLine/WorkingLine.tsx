import { View } from "react-native";

import { SpinningGlyph } from "../../SpinningGlyph";
import { Icon, Text } from "../../ui";

import type { WorkingLineProps } from "./types";

/**
 * The line under your message while the assistant works with no words to show, as `assistant · recipe-reading`
 * draws it: a turning ring in the accent and the words in the secondary caption, from the left. It is a status,
 * so a screen reader announces it once. The words come in by prop, because the line adds none of its own.
 */
export function WorkingLine({ text }: WorkingLineProps) {
  return (
    <View accessible aria-live="polite" className="flex-row items-center gap-2" role="status">
      <SpinningGlyph>
        <Icon name="LoaderCircle" size={16} tone="accent-ink" />
      </SpinningGlyph>
      <Text className="shrink" tone="secondary" variant="caption">
        {text}
      </Text>
    </View>
  );
}
