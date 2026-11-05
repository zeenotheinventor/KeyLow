import { useSyncExternalStore } from "react";

import { useBodyMapRenderer } from "@/lib/bodyMapRenderer";

// Whether 3D has failed in this visit. It is not saved: the next visit tries again.
const failureMemory = { hasFailed: false, listeners: new Set<() => void>() };

function subscribeToFailure(listener: () => void): () => void {
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

// The three.js version in use draws with WebGL 2 only, so a browser that has WebGL 1 alone cannot draw the body.
// The probe makes a canvas, so it is made once, and the context it makes is given back at once.
const probe: { canDraw?: boolean } = {};

/** Forgets that 3D failed and what the WebGL probe found, so each test starts from a fresh visit. For tests only. */
export function resetBody3DSupportForTests(): void {
  failureMemory.hasFailed = false;
  delete probe.canDraw;
}

function canMakeWebGL2Context(): boolean {
  probe.canDraw ??= (() => {
    const context = document.createElement("canvas").getContext("webgl2");
    context?.getExtension("WEBGL_lose_context")?.loseContext();
    return context !== null;
  })();
  return probe.canDraw;
}

const subscribeToNothing = () => () => undefined;
const cannotDraw = () => false;

/**
 * Whether 3D can be tried, and the way to say it failed. It can be tried when the browser can start a WebGL 2
 * context and 3D has not failed in this visit. The browser is only asked when 3D is chosen in More, so a person on 2D
 * never has a context made for them. The server never can, so its first draw and the browser's first render agree on
 * 2D, and the browser says yes in the render that follows. The check reads nothing of three or
 * react-three-fiber. The two halves are given as well, for a reader that must keep its layout when 3D fails after
 * it has drawn.
 */
export function useBody3DSupport(): {
  canTry3d: boolean;
  hasWebGL: boolean;
  hasFailed: boolean;
  markFailed: () => void;
} {
  const hasFailed = useSyncExternalStore(subscribeToFailure, getHasFailed, getHasFailed);
  const { renderer } = useBodyMapRenderer();
  const hasWebGL = useSyncExternalStore(
    subscribeToNothing,
    renderer === "3d" ? canMakeWebGL2Context : cannotDraw,
    cannotDraw,
  );

  return { canTry3d: hasWebGL && !hasFailed, hasWebGL, hasFailed, markFailed };
}
