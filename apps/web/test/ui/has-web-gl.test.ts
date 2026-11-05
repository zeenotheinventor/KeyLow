import { afterEach, describe, expect, it, vi } from "vitest";

import { hasWebGL } from "@/components/ui/Body3D/hasWebGL";

// jsdom has no WebGL, so a stand-in for a context that has only what the check uses.
// The cast is the narrowest that lets it through getContext's types.
function glContext(loseContext: () => void = () => undefined) {
  return {
    getExtension: (name: string) => (name === "WEBGL_lose_context" ? { loseContext } : null),
  } as unknown as WebGLRenderingContext;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("hasWebGL", () => {
  it("should be false when the browser gives no context, as jsdom does not", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

    expect(hasWebGL()).toBe(false);
  });

  it("should ask for WebGL 2 and then WebGL 1, and nothing else", () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

    hasWebGL();

    expect(getContext.mock.calls.map(([contextId]) => contextId)).toEqual(["webgl2", "webgl"]);
  });

  it("should be true when WebGL 1 is there but not WebGL 2", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((contextId: string) =>
      contextId === "webgl" ? glContext() : null,
    );

    expect(hasWebGL()).toBe(true);
  });

  it("should give the context back when it is done with it", () => {
    const loseContext = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() =>
      glContext(loseContext),
    );

    hasWebGL();

    expect(loseContext).toHaveBeenCalledTimes(1);
  });
});
