import { BODY_COMPOSITION } from "@keylow/core/copy";
import { useRouter } from "expo-router";
import { Text as NativeText, View } from "react-native";

import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { BodyCompositionCard } from "../BodyCompositionCard";
import { BodyCompositionPrompt } from "../BodyCompositionPrompt";
import { Skeleton, Text } from "../ui";
import { useBodyCompositionKind } from "./useBodyCompositionKind";

import type { BodyCompositionSectionProps } from "./types";
import type { BodyMeasurementKind } from "@keylow/core/weight";

const OPEN_PERMISSION_FLOW = "/more/weight/health?add=body-composition";

/**
 * The Body composition section of the Weight screen, under the weight chart's legend: a heading over one
 * full width card for each allowed kind that has readings, stacked, and the prompts the other cases need.
 * Nothing is typed here and nothing is deleted. The readings come from Health Connect on their own.
 *
 * Neither kind allowed is the `not-allowed` prompt. A kind still loading is one loading status, and one
 * that failed is the `error` prompt, whose Try again reads the failed kinds again. Otherwise each kind
 * with readings has its card. Both allowed with no readings at all is `no-readings-yet`, and one allowed
 * with none is the same prompt with the compact prompt for the other kind after it. A kind that is
 * allowed with no readings beside one that has some draws nothing, since the card for the other says
 * enough. The caption about lean mass shows only with a lean mass card.
 */
export function BodyCompositionSection({ access, range, today }: BodyCompositionSectionProps) {
  const router = useRouter();
  const isReadEnabled = useReadsEnabled();
  const bodyFat = useBodyCompositionKind("body_fat_pct", {
    isEnabled: access.bodyFat && isReadEnabled,
    range,
    today,
  });
  const leanMass = useBodyCompositionKind("lean_mass_kg", {
    isEnabled: access.leanMass && isReadEnabled,
    range,
    today,
  });

  const readings = [...(access.bodyFat ? [bodyFat] : []), ...(access.leanMass ? [leanMass] : [])];
  const notAllowed: BodyMeasurementKind[] = [
    ...(access.bodyFat ? [] : ["body_fat_pct" as const]),
    ...(access.leanMass ? [] : ["lean_mass_kg" as const]),
  ];
  const openPermissionFlow = () => {
    router.push(OPEN_PERMISSION_FLOW);
  };

  function renderBody() {
    if (readings.length === 0) {
      return (
        <BodyCompositionPrompt
          action={BODY_COMPOSITION.notAllowed.action}
          text={BODY_COMPOSITION.notAllowed.text}
          title={BODY_COMPOSITION.notAllowed.title}
          variant="not-allowed"
          onAction={openPermissionFlow}
        />
      );
    }
    if (readings.some((reading) => reading.status === "loading")) {
      return (
        <View
          accessible
          aria-label={BODY_COMPOSITION.loadingLabel}
          aria-live="polite"
          role="status"
        >
          <Skeleton variant="bodyComposition" />
        </View>
      );
    }
    if (readings.some((reading) => reading.status === "error")) {
      return (
        <BodyCompositionPrompt
          retry={BODY_COMPOSITION.error.retry}
          text={BODY_COMPOSITION.error.body}
          title={BODY_COMPOSITION.error.title}
          variant="error"
          onRetry={() => {
            readings.forEach((reading) => {
              if (reading.status === "error") {
                reading.refetch();
              }
            });
          }}
        />
      );
    }
    const cards = readings.flatMap((reading) =>
      reading.status === "readings" ? [reading.card] : [],
    );

    return (
      <>
        {cards.map((card) => (
          <BodyCompositionCard key={card.kind} {...card} />
        ))}
        {cards.length === 0 ? (
          <BodyCompositionPrompt
            text={BODY_COMPOSITION.noReadings.text}
            title={BODY_COMPOSITION.noReadings.title}
            variant="no-readings-yet"
          />
        ) : null}
        {notAllowed.map((kind) => (
          <BodyCompositionPrompt
            key={kind}
            action={BODY_COMPOSITION.partial[kind].action}
            text={BODY_COMPOSITION.partial[kind].text}
            variant="compact"
            onAction={openPermissionFlow}
          />
        ))}
        {cards.some((card) => card.kind === "lean_mass_kg") ? (
          <NativeText className="px-1 text-caption font-normal tabular-nums text-text-muted">
            {BODY_COMPOSITION.caption}
          </NativeText>
        ) : null}
      </>
    );
  }

  return (
    <View className="gap-2">
      <Text className="px-1" role="heading" variant="body-strong">
        {BODY_COMPOSITION.heading}
      </Text>
      {renderBody()}
    </View>
  );
}
