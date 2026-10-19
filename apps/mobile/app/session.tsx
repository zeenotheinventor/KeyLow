import { useRouter } from "expo-router";

import { SessionScreen } from "../components/SessionScreen";

// A full screen over the tabs, opened by Resume and by the session bar once their tickets wire them. Hiding
// goes back to the tab it came from, and the session keeps running. A cold link to this screen has nothing
// before it, so hiding goes to the Train tab instead. The root layout's AuthGate covers it and the root
// stack gives it no header.
export default function SessionRoute() {
  const router = useRouter();

  return (
    <SessionScreen
      onHide={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/(tabs)/train");
        }
      }}
    />
  );
}
