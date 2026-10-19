import { FINISH_SCREEN } from "@keylow/core/copy";
import { useRouter } from "expo-router";

import { SessionScreen } from "../components/SessionScreen";
import { ToastProvider, useToast } from "../components/ui";

import type { SavedOutcome } from "../components/FinishScreen";

// A full screen over the tabs, opened by Start and Resume on the Train tab, and by the session bar once its
// ticket wires it. Hiding goes back to the tab it came from, and the session keeps running. A cold link to
// this screen has nothing before it, so hiding goes to the Train tab instead. Discarding the session leaves
// the same way: the session is gone, so the tabs are all there is to go back to. Saving the finished session
// shows the Session saved toast and leaves the same way, since the session is no longer the one in
// progress. The root layout's AuthGate covers it and the root stack gives it no header.
export default function SessionRoute() {
  const router = useRouter();
  // The root provider's, since this component sits above the modal's own provider below.
  const toast = useToast();

  function leave() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/train");
    }
  }

  // The toast is raised here, above the screen, so it belongs to the provider that outlives the route.
  // A save can land after the screen has closed (the Android back key, a swipe). The toast still shows, but
  // leaving again would pop a screen the user did not ask to close.
  function finished({ isScreenOpen }: SavedOutcome) {
    toast.show({ message: FINISH_SCREEN.savedToast, tone: "success", icon: "Check" });
    if (isScreenOpen) {
      leave();
    }
  }

  // The screen covers the tabs as a native modal, and on iOS the root toast layer sits beneath a modal, so a
  // toast raised inside it has a provider of its own inside the modal's view tree.
  return (
    <ToastProvider>
      <SessionScreen onDiscarded={leave} onFinished={finished} onHide={leave} />
    </ToastProvider>
  );
}
