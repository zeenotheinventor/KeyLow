import { requireOptionalNativeModule } from "expo";
import { useSyncExternalStore } from "react";

// Whether 3D has failed in this app run. It is not saved: the next launch tries again.
export const failureMemory = { hasFailed: false, listeners: new Set<() => void>() };

function subscribe(listener: () => void): () => void {
  failureMemory.listeners.add(listener);
  return () => {
    failureMemory.listeners.delete(listener);
  };
}

const getHasFailed = () => failureMemory.hasFailed;

function markFailed(): void {
  if (!failureMemory.hasFailed) {
    failureMemory.hasFailed = true;
    failureMemory.listeners.forEach((listener) => {
      listener();
    });
  }
}

/**
 * Whether 3D can be tried, and the way to say it failed. It can be tried when the build has the GL
 * native module, which a build made before expo-gl was added does not, and 3D has not failed since the
 * app started. The two halves are given as well, for a reader that must keep its layout when 3D fails
 * after it has drawn. The check looks the native module up and reads nothing of three or react-three-fiber.
 */
export function useBody3DSupport(): {
  canTry3d: boolean;
  hasGlModule: boolean;
  hasFailed: boolean;
  markFailed: () => void;
} {
  const hasFailed = useSyncExternalStore(subscribe, getHasFailed);
  const hasGlModule = requireOptionalNativeModule("ExpoGL") !== null;

  return { canTry3d: hasGlModule && !hasFailed, hasGlModule, hasFailed, markFailed };
}
