import { useRouter } from "expo-router";

import { SessionScreen } from "../components/SessionScreen";
import { ToastProvider } from "../components/ui";

// A full screen over the tabs, opened by Start and Resume on the Train tab, and by the session bar once its
// ticket wires it. Hiding goes back to the tab it came from, and the session keeps running. A cold link to
// this screen has nothing before it, so hiding goes to the Train tab instead. Discarding the session leaves
// the same way: the session is gone, so the tabs are all there is to go back to. The root layout's AuthGate
// covers it and the root stack gives it no header.
export default function SessionRoute() {
  const router = useRouter();

  function leave() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/train");
    }
  }

  // The screen covers the tabs as a native modal, and on iOS the root toast layer sits beneath a modal, so a
  // toast raised here has a provider of its own inside the modal's view tree.
  return (
    <ToastProvider>
      <SessionScreen onDiscarded={leave} onHide={leave} />
    </ToastProvider>
  );
}
