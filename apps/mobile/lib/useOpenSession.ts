import { useRouter } from "expo-router";
import { useRef } from "react";

// A second press of a control that opens the session within this long is the same press: pushing the screen twice would stack it.
const OPEN_COOLDOWN_MILLISECONDS = 1000;

/**
 * Opens the session screen for the session in progress, once for a press however fast the second comes.
 * Every control that opens it (Start and Resume on the Train home, the session bar) gets its own cooldown.
 */
export function useOpenSession(): () => void {
  const router = useRouter();
  const lastOpenedAt = useRef<number | null>(null);

  return () => {
    const now = Date.now();
    if (lastOpenedAt.current !== null && now - lastOpenedAt.current < OPEN_COOLDOWN_MILLISECONDS) {
      return;
    }
    lastOpenedAt.current = now;
    router.push("/session");
  };
}
