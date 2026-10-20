import { useLocalSearchParams, useRouter } from "expo-router";

import { ExerciseProgressScreen } from "../../../../components/ExerciseProgressScreen";
import { progressBackPath } from "../../../../lib/progressRoutes";

// Pushed inside the Train tab, over the routines list, from an exercise of the Progress section. The address
// holds the exercise's id and nothing else. The root layout's AuthGate covers it, and the stack above gives
// it no header.
export default function ExerciseProgressRoute() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const router = useRouter();

  function goBack() {
    // A cold link to this screen has nothing before it, so Back goes to the routines instead.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(progressBackPath());
    }
  }

  return <ExerciseProgressScreen exerciseId={exerciseId} onBack={goBack} />;
}
