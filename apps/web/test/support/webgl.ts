import { vi } from "vitest";

type StubbedWebGL = {
  /** Whether a canvas can start a WebGL 2 context. */
  available: boolean;
  /** Called when the context that was made is given back. */
  loseContext?: () => void;
};

/**
 * Stands in for the canvas's `getContext`, since jsdom has no WebGL. With `available` a canvas gives a context
 * that can be given back, and without it `getContext` gives null, as a browser with WebGL off does.
 */
export function stubWebGL({ available, loseContext = () => undefined }: StubbedWebGL) {
  const context = {
    getExtension: (name: string) => (name === "WEBGL_lose_context" ? { loseContext } : null),
  };
  const getContext = (kind: string) => (available && kind === "webgl2" ? context : null);
  // `getContext` is overloaded for each kind of context, which a stand-in with one signature cannot satisfy.
  return vi
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockImplementation(getContext as unknown as typeof HTMLCanvasElement.prototype.getContext);
}
