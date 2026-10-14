import { useNavigation, useRouter } from "expo-router";
import { useCallback } from "react";

/**
 * Returns what closes the food search sheet from any screen inside it. The sheet is one screen of the root
 * stack and the screens it opens sit deeper, in its own stack, so going back from one only returns to the
 * screen before it. The sheet is dismissed by going back in the navigator above, which leaves the user
 * where the sheet was opened. When the sheet is the only screen there is, as after a cold link to a screen
 * in it, there is nothing above to go back to, so the user goes to the dashboard, as the search sheet's own
 * close does.
 */
export function useCloseFoodsSheet(): () => void {
  const navigation = useNavigation();
  const router = useRouter();

  return useCallback(() => {
    const parent = navigation.getParent();

    if (parent?.canGoBack() === true) {
      parent.goBack();
    } else {
      router.replace("/(tabs)/dashboard");
    }
  }, [navigation, router]);
}
