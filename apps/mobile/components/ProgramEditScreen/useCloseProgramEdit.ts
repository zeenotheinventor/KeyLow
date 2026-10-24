import { useRouter } from "expo-router";
import { useCallback } from "react";

/** Leaves Edit programme for the Programme screen. A link can open the screen cold, with nothing under it, and then it replaces itself. */
export function useCloseProgramEdit(): () => void {
  const router = useRouter();

  return useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/more/program");
    }
  }, [router]);
}
