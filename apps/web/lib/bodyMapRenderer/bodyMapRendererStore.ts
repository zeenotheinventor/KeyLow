import { readBodyMapRenderer, writeBodyMapRenderer } from "./bodyMapRendererStorage";

import type { BodyMapRenderer } from "@keylow/core/training";

/**
 * One renderer for the whole site, because the More row and the body map must change together. The
 * browser's storage is read once, on the first read in the browser, and the renderer is held here from
 * then on, so a choice that cannot be saved still applies for the visit.
 */
export function createBodyMapRendererStore() {
  let renderer: BodyMapRenderer | null = null;
  const listeners = new Set<() => void>();

  return {
    // This reads storage during render, which is safe only because the server snapshot is null, so the
    // server and the first draw in the browser agree. A reuse must keep that.
    getSnapshot: (): BodyMapRenderer => (renderer ??= readBodyMapRenderer()),
    getServerSnapshot: (): BodyMapRenderer | null => null,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setRenderer: (next: BodyMapRenderer) => {
      renderer = next;
      writeBodyMapRenderer(next);
      for (const listener of listeners) {
        listener();
      }
    },
  };
}
