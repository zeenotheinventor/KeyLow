import { LEGAL_URLS } from "@keylow/core/copy";
import { Redirect } from "expo-router";
import { Linking, View } from "react-native";

import { HealthAccessView } from "./HealthAccessView";
import { useHealthAccessFlow } from "./useHealthAccessFlow";

import type { HealthAccessScreenProps } from "./types";

/**
 * The Health Connect permissions flow: the state it is in, chosen from what the provider and the import
 * say, drawn by the view. Where the device has no Health Connect at all it replaces itself with the Weight
 * screen. Close, Not now and See your trend all call `onClose`.
 */
export function HealthAccessScreen({ provider, onClose }: HealthAccessScreenProps) {
  const flow = useHealthAccessFlow(provider, onClose);

  if (flow.phase === "unsupported") {
    return <Redirect href="/more/weight" />;
  }
  // The checks are native calls that answer at once, so what shows meanwhile is the screen's own background.
  if (flow.phase === "checking") {
    return <View className="flex-1 bg-background" />;
  }

  return (
    <HealthAccessView
      importedCount={flow.importedCount}
      step={flow.step}
      onClose={onClose}
      onOpenPrivacyPolicy={() => {
        // A device with no browser rejects, and there is nothing else to do about it, so the screen stays as it is.
        Linking.openURL(LEGAL_URLS.privacy).catch(() => undefined);
      }}
      onPrimary={flow.onPrimary}
      onSecondary={onClose}
    />
  );
}
