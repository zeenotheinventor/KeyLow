import { PROGRAM_TOAST } from "@keylow/core/copy";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

import { useToast } from "@/components/ui/Toast";
import { hasNewTargets, subscribeToNewTargets, takeNewTargets } from "@/lib/checkinToast";

const PROGRAMME_HREF = "/more/program";

const subscribeToVisibility = (onChange: () => void) => {
  document.addEventListener("visibilitychange", onChange);
  return () => {
    document.removeEventListener("visibilitychange", onChange);
  };
};
const isTabInView = () => document.visibilityState === "visible";

/**
 * Tells the person, once, that a check-in has set a new calorie target: a toast with a way to see why. It speaks
 * only while the Diary is the page in front and the tab is in view. A check-in that lands while they are elsewhere
 * waits for their next visit to the Diary, and the signal is used up as it is shown, so a later visit says
 * nothing. The toast appears on arrival and not after a keyboard action, so it asks for no focus on its action.
 */
export function useCheckinToast(): void {
  const router = useRouter();
  const toast = useToast();
  const isWaiting = useSyncExternalStore(subscribeToNewTargets, hasNewTargets, () => false);
  const isInView = useSyncExternalStore(subscribeToVisibility, isTabInView, () => false);

  useEffect(() => {
    if (!isInView || !isWaiting || !takeNewTargets()) {
      return;
    }

    toast.show({
      message: PROGRAM_TOAST.message,
      icon: RefreshCw,
      actionLabel: PROGRAM_TOAST.actionLabel,
      onAction: () => {
        router.push(PROGRAMME_HREF);
      },
    });
  }, [isInView, isWaiting, router, toast]);
}
