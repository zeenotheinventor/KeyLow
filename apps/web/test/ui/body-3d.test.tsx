import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Body3DCanvasProps } from "@/components/ui/Body3D/Body3DCanvas";

import { Body3D } from "@/components/ui/Body3D";
import { hasWebGL } from "@/components/ui/Body3D/hasWebGL";

// jsdom has no WebGL and the real canvas needs it, so the canvas module is stood in for. What it draws is proved in a real browser.
const drawnWith = vi.hoisted((): { props: Body3DCanvasProps[]; shouldThrow: boolean } => ({
  props: [],
  shouldThrow: false,
}));

vi.mock("@/components/ui/Body3D/hasWebGL", () => ({ hasWebGL: vi.fn() }));

vi.mock("@/components/ui/Body3D/Body3DCanvas", () => ({
  Body3DCanvas: (props: Body3DCanvasProps) => {
    if (drawnWith.shouldThrow) {
      throw new Error("The model could not be read.");
    }
    drawnWith.props.push(props);
    return <p>The canvas</p>;
  },
}));

const label = "Body map in 3D, front";

function lastCanvasProps(): Body3DCanvasProps {
  const [latest] = drawnWith.props.slice(-1);
  if (latest === undefined) {
    throw new Error("The canvas was not drawn.");
  }
  return latest;
}

beforeEach(() => {
  drawnWith.props = [];
  drawnWith.shouldThrow = false;
  vi.mocked(hasWebGL).mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Body3D", () => {
  it("should be one image named by its label", () => {
    render(<Body3D label={label} w={200} />);

    expect(screen.getByRole("img", { name: label })).toBeTruthy();
  });

  it("should draw the lazy canvas once WebGL is there", async () => {
    render(<Body3D label={label} w={200} />);

    expect(await screen.findByText("The canvas")).toBeTruthy();
  });

  it("should hand the canvas the value props with the figure's defaults", async () => {
    render(<Body3D label={label} w={200} />);

    await screen.findByText("The canvas");
    expect(lastCanvasProps()).toMatchObject({
      scale: "heat",
      values: {},
      dim: 1,
      unselectedOpacity: 1,
      selected: undefined,
    });
    expect(lastCanvasProps().pose.yaw).toBe(0);
  });

  it("should hand the canvas the values, the scale, the selection and the side it was given", async () => {
    render(
      <Body3D
        dim={0.3}
        label={label}
        scale="volume"
        selected="quads"
        side="back"
        unselectedOpacity={0.5}
        values={{ quads: 3 }}
        w={200}
      />,
    );

    await screen.findByText("The canvas");
    expect(lastCanvasProps()).toMatchObject({
      scale: "volume",
      values: { quads: 3 },
      selected: "quads",
      dim: 0.3,
      unselectedOpacity: 0.5,
    });
    expect(lastCanvasProps().pose.yaw).toBe(Math.PI);
  });

  it("should ease and turn over the standard 220 ms", async () => {
    render(<Body3D label={label} w={200} />);

    await screen.findByText("The canvas");
    expect(lastCanvasProps().motionMilliseconds).toBe(220);
  });

  it("should not ease or turn with reduced motion", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    render(<Body3D label={label} w={200} />);

    await screen.findByText("The canvas");
    expect(lastCanvasProps().motionMilliseconds).toBe(0);
    vi.unstubAllGlobals();
  });

  it("should frame the body at the 200 by 440 drawing of the figure", async () => {
    render(<Body3D label={label} w={100} />);

    await screen.findByText("The canvas");
    expect(lastCanvasProps().frameAspect).toBeCloseTo(200 / 440);
  });

  it("should pass the first frame on to the caller", async () => {
    const onFirstFrame = vi.fn();
    render(<Body3D label={label} w={200} onFirstFrame={onFirstFrame} />);

    await screen.findByText("The canvas");
    lastCanvasProps().onFirstFrame?.();

    expect(onFirstFrame).toHaveBeenCalledTimes(1);
  });

  it("should hydrate the markup of a server that cannot draw, with no warning, and then draw", async () => {
    // The server has no WebGL and the browser has, which is every page load.
    vi.mocked(hasWebGL).mockReturnValue(false);
    const container = document.createElement("div");
    container.innerHTML = renderToString(<Body3D label={label} w={200} />);
    document.body.append(container);
    vi.mocked(hasWebGL).mockReturnValue(true);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    act(() => {
      hydrateRoot(container, <Body3D label={label} w={200} />);
    });

    expect(await screen.findByText("The canvas")).toBeTruthy();
    expect(consoleError).not.toHaveBeenCalled();
    container.remove();
  });

  describe("with no WebGL", () => {
    beforeEach(() => {
      vi.mocked(hasWebGL).mockReturnValue(false);
    });

    it("should call onError once", async () => {
      const onError = vi.fn();
      render(<Body3D label={label} w={200} onError={onError} />);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
      });
    });

    it("should not load the canvas and should write nothing on screen", async () => {
      const onError = vi.fn();
      const { container } = render(<Body3D label={label} w={200} onError={onError} />);

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });
      expect(screen.queryByText("The canvas")).toBeNull();
      expect(container.textContent).toBe("");
      expect(screen.getByRole("img", { name: label })).toBeTruthy();
    });
  });

  describe("when the canvas fails to draw", () => {
    beforeEach(() => {
      drawnWith.shouldThrow = true;
      // React logs a render error that a boundary caught, which this test provokes on purpose.
      vi.spyOn(console, "error").mockImplementation(() => undefined);
    });

    it("should call onError once", async () => {
      const onError = vi.fn();
      render(<Body3D label={label} w={200} onError={onError} />);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
      });
    });

    it("should write nothing on screen, not even the error", async () => {
      const onError = vi.fn();
      const { container } = render(<Body3D label={label} w={200} onError={onError} />);

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });
      expect(container.textContent).toBe("");
    });
  });

  it("should call onError once however many ways the canvas reports a failure", async () => {
    const onError = vi.fn();
    render(<Body3D label={label} w={200} onError={onError} />);

    await screen.findByText("The canvas");
    lastCanvasProps().onError?.();
    lastCanvasProps().onError?.();

    expect(onError).toHaveBeenCalledTimes(1);
  });
});
