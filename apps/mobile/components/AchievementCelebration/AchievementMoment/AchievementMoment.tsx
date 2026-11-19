import { ACHIEVEMENT_CELEBRATION } from "@keylow/core/copy";
import { vars } from "nativewind";
import { Modal, Text as NativeText, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Spark } from "./Spark";
import { useRingStyle } from "./useMomentMotion";
import { AchievementBadge, Badge, Button, Text } from "../../ui";

import type { AchievementMomentProps } from "./types";
import type { BadgeTone } from "../../ui";

// Board 3 draws the sparks in the gold, the accent, the protein blue and the fat pink, at these places
// around the ring, in points from its middle. The classes are written out so Tailwind sees them.
const sparks = [
  { x: -121, y: -58, className: "bg-carbs" },
  { x: 107, y: -18, className: "bg-accent" },
  { x: -81, y: 82, className: "bg-protein" },
  { x: 131, y: 112, className: "bg-fat" },
] as const;

const chipTones = {
  points: "accent",
  freeze: "protein",
  level: "accent",
} as const satisfies Record<AchievementMomentProps["summary"]["chips"][number]["kind"], BadgeTone>;

// Gold is drawn in the gold, Platinum in the accent. The eyebrow takes the ink tones, which are the colour in
// dark and the primary text colour in light, where the colour is too faint for small text.
const haloClassName = { gold: "bg-carbs-muted", platinum: "bg-accent-muted" } as const;
const eyebrowTone = { gold: "warning-ink", platinum: "accent-ink" } as const;

/** The bottom padding under the buttons is the board's 40, of which the home indicator's inset is part. */
const bottomPaddingBelowInset = 6;

/**
 * The full-screen moment for a new Gold or Platinum, as board 3 draws it: the medal in its ring scaling in on
 * the spring ease, sparks drifting out over 400 ms, the tier, the name, how it was earned, the points and
 * freeze chips, then Nice one and See all achievements. With reduced motion everything is drawn in place.
 * It is a modal, so it covers the native sheets too, and the back gesture closes it like Nice one.
 */
export function AchievementMoment({ summary, onDismiss, onSeeAll }: AchievementMomentProps) {
  const { bottom } = useSafeAreaInsets();
  const ringStyle = useRingStyle();
  const tier = summary.leadTier === "platinum" ? "platinum" : "gold";

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onDismiss}>
      <View
        accessibilityViewIsModal
        aria-label={summary.dialogLabel ?? summary.title}
        className="flex-1 bg-background"
      >
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <View className="h-[172px] w-[172px] items-center justify-center">
            {sparks.map((spark) => (
              <Spark key={spark.className} {...spark} />
            ))}
            {/* A class and an animated style cannot share an element, so the scale sits on a wrapper with no class. */}
            <Animated.View style={ringStyle}>
              <View className={`rounded-full p-3 ${haloClassName[tier]}`}>
                <AchievementBadge decorative id={summary.leadId} size={148} />
              </View>
            </Animated.View>
          </View>
          <Text className="tracking-[0.08em]" tone={eyebrowTone[tier]} variant="label-small">
            {summary.tierLabel ?? ""}
          </Text>
          {/* The board sets the name at 32 over 38, above the type scale's largest heading. */}
          <NativeText
            className="text-center text-[32px] font-semibold leading-[38px] tracking-[-0.02em] text-text-primary"
            role="heading"
          >
            {summary.title}
          </NativeText>
          <Text className="text-center" tone="secondary">
            {summary.body}
          </Text>
          {summary.othersLine === null ? null : (
            <Text className="text-center" tone="secondary" variant="caption">
              {summary.othersLine}
            </Text>
          )}
          <View className="flex-row flex-wrap justify-center gap-[6px]">
            {summary.chips.map(({ kind, label }) => (
              <Badge key={label} tone={chipTones[kind]}>
                {label}
              </Badge>
            ))}
          </View>
        </View>
        {/* The inset is a runtime value no class can name, so it goes through a variable. */}
        <View
          className="gap-1 px-6 pb-[var(--moment-bottom)]"
          style={vars({ "--moment-bottom": bottom + bottomPaddingBelowInset })}
        >
          <Button fullWidth size="lg" onPress={onDismiss}>
            {ACHIEVEMENT_CELEBRATION.momentDismiss}
          </Button>
          <Button fullWidth quiet size="lg" variant="ghost" onPress={onSeeAll}>
            {ACHIEVEMENT_CELEBRATION.momentSeeAll}
          </Button>
        </View>
      </View>
    </Modal>
  );
}
