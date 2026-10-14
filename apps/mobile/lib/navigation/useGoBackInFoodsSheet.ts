import { useRouter } from "expo-router";
import { useCallback } from "react";

/**
 * Returns what goes back one screen inside the food sheet, for the back control of a screen the search
 * opened. When there is no screen to go back to, as after a cold link to a screen in the sheet, the user
 * goes to the search instead.
 */
export function useGoBackInFoodsSheet(): () => void {
  const router = useRouter();

  return useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/foods");
    }
  }, [router]);
}
