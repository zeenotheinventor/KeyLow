import { describeFoodSource } from "@keylow/core/copy";
import { vars } from "nativewind";
import { Text as NativeText, View } from "react-native";

import { useTheme } from "../../../lib/theme";
import { useCappedLineHeight } from "../../../lib/useCappedLineHeight";

import type { BadgeProps, BadgeTone } from "./types";

// The classes are written out so Tailwind sees them. A status tone is the tone's muted fill with the
// tone's colour as the text. In light that colour is too faint for small text, so the text falls back to
// the primary text colour and the colour stays as the fill and the dot (Q14). Success is the exception:
// it has an ink token, a darker green that reads as text in light. Neutral and the source badge are the
// sheet surface with secondary text, in both schemes.
const tones: Record<
  BadgeTone,
  {
    fillClassName: string;
    darkTextClassName: string;
    lightTextClassName?: string;
    dotClassName: string;
  }
> = {
  neutral: {
    fillClassName: "bg-surface-sheet",
    darkTextClassName: "text-text-secondary",
    dotClassName: "bg-text-secondary",
  },
  accent: {
    fillClassName: "bg-accent-muted",
    darkTextClassName: "text-accent",
    dotClassName: "bg-accent",
  },
  success: {
    fillClassName: "bg-success-muted",
    darkTextClassName: "text-success",
    lightTextClassName: "text-success-ink",
    dotClassName: "bg-success",
  },
  warning: {
    fillClassName: "bg-warning-muted",
    darkTextClassName: "text-warning",
    dotClassName: "bg-warning",
  },
  danger: {
    fillClassName: "bg-danger-muted",
    darkTextClassName: "text-danger",
    dotClassName: "bg-danger",
  },
  protein: {
    fillClassName: "bg-protein-muted",
    darkTextClassName: "text-protein",
    dotClassName: "bg-protein",
  },
  carbs: {
    fillClassName: "bg-carbs-muted",
    darkTextClassName: "text-carbs",
    dotClassName: "bg-carbs",
  },
  fat: {
    fillClassName: "bg-fat-muted",
    darkTextClassName: "text-fat",
    dotClassName: "bg-fat",
  },
  calories: {
    fillClassName: "bg-calories-muted",
    darkTextClassName: "text-calories",
    dotClassName: "bg-calories",
  },
};

// The caption's own line height, and how far its font may grow at large text.
const captionLineHeight = 16;
const maxFontScale = 1.3;

/** Names where a food came from, or a short status. The text always carries the meaning. */
export function Badge(props: BadgeProps) {
  const { scheme } = useTheme();
  const lineHeight = useCappedLineHeight(captionLineHeight, maxFontScale);

  const isSource = props.kind === "source";
  const isOutlined = isSource || props.outlined === true;
  const tone = isSource ? "neutral" : (props.tone ?? "neutral");
  const look = tones[tone];
  const text = isSource ? describeFoodSource(props.source) : props.children;
  const lightTextClassName = look.lightTextClassName ?? "text-text-primary";
  const textClassName =
    scheme === "light" && tone !== "neutral" ? lightTextClassName : look.darkTextClassName;

  return (
    <View
      // A transparent border keeps a status badge the same size as a source badge, which draws one.
      className={`h-5 flex-row items-center gap-[5px] self-start rounded-pill border px-2 ${look.fillClassName} ${isOutlined ? "border-border" : "border-transparent"}`}
    >
      {!isSource && props.dot === true ? (
        <View aria-hidden className={`h-[6px] w-[6px] rounded-pill ${look.dotClassName}`} />
      ) : null}
      {/* Capped so the line stays inside the 20 point pill at large text, which a fixed height cannot grow with. The line height is a runtime value no class can name, so it goes through a variable. */}
      <NativeText
        className={`text-caption font-medium leading-[var(--badge-line)] tabular-nums ${textClassName}`}
        maxFontSizeMultiplier={maxFontScale}
        numberOfLines={1}
        style={vars({ "--badge-line": lineHeight })}
      >
        {text}
      </NativeText>
    </View>
  );
}
