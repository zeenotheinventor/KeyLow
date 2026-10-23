import { useWeightTrend } from "@keylow/api-client";
import { Stack, useRouter } from "expo-router";

import { TrendExplainerSheet } from "../../../../components/TrendExplainerSheet";
import { useReadsEnabled } from "../../../../lib/useReadsEnabled";

// The sheet that explains the trend weight, pushed over the Weight screen and drawn above it: the screen is a
// transparent modal that fades in, so the sheet's own dim covers Weight, which stays on show behind it, as the
// weigh-in sheet's route does. Its presentation is set here and not in the stack's layout, which holds none of
// the screens' options.

// Closes the sheet. A link can open it cold, with nothing behind it, and going back would then throw, so it
// replaces itself with the Weight screen, as the other screens a link can open do.
function useCloseExplainer() {
  const router = useRouter();

  return () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/more/weight");
    }
  };
}

export default function TrendExplainerRoute() {
  const close = useCloseExplainer();
  const trend = useWeightTrend({ enabled: useReadsEnabled() });
  const lastPoint = trend.points[trend.points.length - 1];

  return (
    <>
      <Stack.Screen
        options={{
          presentation: "transparentModal",
          animation: "fade",
          // The stack paints every screen on the background colour. A transparent modal sets none of its own,
          // so clearing the stack's lets Weight show through the sheet's dim.
          contentStyle: undefined,
        }}
      />
      <TrendExplainerSheet
        open
        // The count is the accepted readings on the last point, and a trend with none to count is not settling.
        settlingObservationCount={trend.settling ? lastPoint?.nObs : undefined}
        onClose={close}
      />
    </>
  );
}
