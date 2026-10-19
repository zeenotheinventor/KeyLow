import { useRouter } from "expo-router";

import { HistoryScreen } from "../../../components/HistoryScreen";
import { useTrainSessionActions } from "../../../components/TrainScreen";

// Pushed inside the Train tab from the Train home's History link. The root layout's AuthGate covers it, and
// the stack above gives it no header.
export default function HistoryRoute() {
  const router = useRouter();
  const { start, isStarting } = useTrainSessionActions();

  function goBack() {
    // A cold link to this screen has nothing before it, so Back goes to the Train home instead.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/train");
    }
  }

  return <HistoryScreen isStarting={isStarting} onBack={goBack} onStartSession={start} />;
}
