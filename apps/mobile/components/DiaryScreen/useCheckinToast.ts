import { PROGRAM_TOAST } from "@keylow/core/copy";
import { useIsFocused, useRouter } from "expo-router";
import { useEffect, useSyncExternalStore } from "react";

import { hasNewTargets, subscribeToNewTargets, takeNewTargets } from "../../lib/checkinToast";
import { haptic } from "../../lib/haptics";
import { useToast } from "../ui";

/**
 * Tells the person, once, that a check-in has set a new calorie target: a toast with a way to see why, and
 * the complete haptic. It speaks only while the diary is the screen in front. A check-in that lands while
 * they are elsewhere waits for their next visit to the diary, and the signal is used up as it is shown, so
 * a later visit says nothing.
 */
export function useCheckinToast(): void {
  const router = useRouter();
  const toast = useToast();
  const isFocused = useIsFocused();
  const isWaiting = useSyncExternalStore(subscribeToNewTargets, hasNewTargets);

  useEffect(() => {
    if (!isFocused || !isWaiting || !takeNewTargets()) {
      return;
    }

    toast.show({
      message: PROGRAM_TOAST.message,
      icon: "RefreshCw",
      actionLabel: PROGRAM_TOAST.actionLabel,
      onAction: () => {
        router.push("/more/program");
      },
    });
    void haptic.complete();
  }, [isFocused, isWaiting, router, toast]);
}
