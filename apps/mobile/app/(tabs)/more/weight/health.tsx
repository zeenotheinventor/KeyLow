import { Redirect, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import { HealthAccessScreen } from "../../../../components/HealthAccessScreen";
import { getHealthProvider } from "../../../../lib/health";

// The Health Connect permissions flow, pushed over the Weight screen as a modal, with its own Close button.
// Its presentation is set here and not in the stack's layout, which holds none of the screens' options.
// The search parameter `add=body-composition` asks for body fat and lean mass alone, for a person whose
// weight is already connected. Any other value, and weight not held, run the first-time flow.
export default function HealthAccessRoute() {
  const router = useRouter();
  const { add } = useLocalSearchParams<{ add?: string }>();
  const mode = add === "body-composition" ? "add-body-composition" : "first";
  // One provider for the life of the screen: asking for one makes a new object each time.
  const [provider] = useState(getHealthProvider);

  // A link can open the flow cold, with nothing behind it, and going back would then throw, so it replaces
  // itself with the Weight screen, as the other screens a link can open do.
  function close() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/more/weight");
    }
  }

  // No Health provider, which is every platform but Android, has no flow to offer.
  if (provider === null) {
    return <Redirect href="/more/weight" />;
  }

  return (
    <>
      <Stack.Screen options={{ presentation: "modal" }} />
      <HealthAccessScreen mode={mode} provider={provider} onClose={close} />
    </>
  );
}
