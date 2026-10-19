import { useLocalSearchParams, useRouter } from "expo-router";

import { SessionDetailScreen } from "../../../../components/SessionDetailScreen";
import { historyPath } from "../../../../lib/historyRoutes";
import { trainPath } from "../../../../lib/routineRoutes";

// Pushed inside the Train tab, over the history list, the Train home when a session opens from the Today card
// or the week strip. The static `history` screen beside this folder is the list. The root layout's AuthGate
// covers it, and the stack above gives it no header.
export default function SessionDetailRoute() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const router = useRouter();

  // The Today card and the week strip open the session with `?from=train`; the history list opens it bare.
  const origin = from === "train" ? "train" : "history";

  function goBack() {
    // A cold link to this screen has nothing before it, so Back goes to the screen it is named for instead.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(origin === "train" ? trainPath() : historyPath());
    }
  }

  return (
    <SessionDetailScreen
      id={id}
      origin={origin}
      onBack={goBack}
      onOpenHistory={() => {
        router.dismissTo(historyPath());
      }}
    />
  );
}
