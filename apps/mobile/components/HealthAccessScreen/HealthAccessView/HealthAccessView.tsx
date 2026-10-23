import {
  HEALTH_ACCESS,
  HEALTH_ACCESS_BODY_POINTS,
  HEALTH_ACCESS_EXPLAIN_POINTS,
  describeBodyCounts,
  describeImportedCount,
} from "@keylow/core/copy";
import { vars } from "nativewind";
import { Pressable, ScrollView, Text as NativeText, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BodyCompositionPrompt } from "../../BodyCompositionPrompt";
import { Button, IconButton, Text } from "../../ui";
import { HealthAccessPoints } from "../HealthAccessPoints";
import { HealthAccessSteps } from "../HealthAccessSteps";
import { HealthAccessTile } from "../HealthAccessTile";

import type { HealthAccessViewProps } from "./types";
import type { BodyCompositionAccess } from "../../../lib/health";
import type { HealthAccessStep } from "../types";

type StepWords = Readonly<{
  heading: string;
  body: string;
  primary: string;
  secondary?: string;
  steps?: readonly string[];
}>;

function wordsOf(
  step: HealthAccessStep,
  importedCount: number,
  { bodyFat, leanMass }: BodyCompositionAccess,
): StepWords {
  switch (step) {
    case "explain":
      return HEALTH_ACCESS.explain;
    case "install":
      return HEALTH_ACCESS.install;
    case "connecting":
      return {
        ...HEALTH_ACCESS.connecting,
        body:
          bodyFat || leanMass
            ? HEALTH_ACCESS.connecting.bodyWithBodyComposition
            : HEALTH_ACCESS.connecting.body,
      };
    case "denied":
      return HEALTH_ACCESS.denied;
    case "import-error":
      return HEALTH_ACCESS.importError;
    case "connected":
    case "connected-partial":
      return { ...HEALTH_ACCESS.connected, heading: describeImportedCount(importedCount) };
    case "explain-body-composition":
      return HEALTH_ACCESS.explainBodyComposition;
    case "denied-body-composition":
      return HEALTH_ACCESS.deniedBodyComposition;
  }
}

// What the partial block says, by what was not allowed.
function partialWordsOf({ bodyFat, leanMass }: BodyCompositionAccess) {
  if (bodyFat) {
    return HEALTH_ACCESS.connectedPartial.leanMassMissing;
  }
  return leanMass
    ? HEALTH_ACCESS.connectedPartial.bodyFatMissing
    : HEALTH_ACCESS.connectedPartial.neither;
}

// The privacy link is a line of caption text, so it reaches the 44 point touch target by hit slop.
const privacyLinkHitSlop = { top: 4, bottom: 4 };

/**
 * The Health Connect permissions flow, one state at a time, as `health-access: permissions flow` draws
 * it: the Close button, a tile, the heading and sentence, the points or the numbered steps, and the
 * buttons. It holds no state and asks for nothing: the flow around it chooses the step and answers the
 * buttons. The main area scrolls, and the tile above the heading keeps its size while it does.
 */
export function HealthAccessView({
  step,
  importedCount,
  bodyCounts,
  bodyCompositionAccess,
  onClose,
  onPrimary,
  onSecondary,
  onOpenPrivacyPolicy,
  onAddBodyComposition,
}: HealthAccessViewProps) {
  const insets = useSafeAreaInsets();
  const words = wordsOf(step, importedCount, bodyCompositionAccess);
  const isConnected = step === "connected" || step === "connected-partial";
  const bodyCountsLine = isConnected ? describeBodyCounts(bodyCounts) : null;
  const partialWords = partialWordsOf(bodyCompositionAccess);

  return (
    // The insets are runtime values no class can name, so they go through variables, as the About screen's do.
    <View
      className="flex-1 bg-background pb-[var(--inset-bottom)] pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top, "--inset-bottom": insets.bottom })}
    >
      <View className="flex-row items-center px-2">
        <IconButton
          icon="X"
          iconSize={22}
          label={HEALTH_ACCESS.closeLabel}
          variant="ghost"
          onPress={onClose}
        />
      </View>
      <ScrollView className="flex-1" contentContainerClassName="gap-5 px-6 pt-4">
        <HealthAccessTile step={step} />
        <View className="gap-2">
          <Text role="heading" variant="h1">
            {words.heading}
          </Text>
          {bodyCountsLine === null ? null : (
            <Text tone="secondary" variant="label-small">
              {bodyCountsLine}
            </Text>
          )}
          <Text role={step === "import-error" ? "alert" : undefined} tone="secondary">
            {words.body}
          </Text>
        </View>
        {step === "explain" ? (
          <>
            <HealthAccessPoints points={HEALTH_ACCESS_EXPLAIN_POINTS} />
            {/* The caption sits 8 points closer to the card than the area's gap, as the board draws it. */}
            <NativeText className="-mt-2 px-1 text-caption font-normal tabular-nums text-text-muted">
              {HEALTH_ACCESS.explainOptionalNote}
            </NativeText>
          </>
        ) : null}
        {step === "explain-body-composition" ? (
          <HealthAccessPoints points={HEALTH_ACCESS_BODY_POINTS} />
        ) : null}
        {step === "connected-partial" ? (
          <BodyCompositionPrompt
            action={partialWords.action}
            text={partialWords.text}
            onAction={onAddBodyComposition}
          />
        ) : null}
        {words.steps === undefined ? null : <HealthAccessSteps steps={words.steps} />}
      </ScrollView>
      <View className="gap-2 px-6 pb-2 pt-4">
        {step === "explain" || step === "explain-body-composition" ? (
          <Pressable
            className="self-center px-2 py-2"
            hitSlop={privacyLinkHitSlop}
            role="link"
            onPress={onOpenPrivacyPolicy}
          >
            <Text tone="secondary" variant="label-small">
              {HEALTH_ACCESS.privacyPolicyLink}
            </Text>
          </Pressable>
        ) : null}
        <Button disabled={step === "connecting"} fullWidth size="lg" onPress={onPrimary}>
          {words.primary}
        </Button>
        {words.secondary === undefined ? null : (
          <Button fullWidth quiet variant="ghost" onPress={onSecondary}>
            {words.secondary}
          </Button>
        )}
      </View>
    </View>
  );
}
