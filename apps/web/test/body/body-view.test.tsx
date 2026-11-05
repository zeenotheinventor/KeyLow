import { describeBodyFigureLoading3d } from "@keylow/core/copy";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubWebGL } from "../support/webgl";

import type { Body3DProps } from "@/components/ui/Body3D";

import { BodyView } from "@/components/body/BodyView";
import { resetBody3DSupportForTests } from "@/components/body/BodyView/testing";
import { resetBodyFigureForTests } from "@/lib/bodyFigure/testing";
import { resetBodyMapRendererForTests } from "@/lib/bodyMapRenderer/testing";

// jsdom has no WebGL, so the 3D body is stood in for. Its module is read through import(), so counting the times
// the factory runs counts the times the 3D code was loaded.
const body3D = vi.hoisted((): { loads: number; latest: Body3DProps | null } => ({
  loads: 0,
  latest: null,
}));

vi.mock("@/components/ui/Body3D", () => {
  body3D.loads += 1;
  return {
    Body3D: (props: Body3DProps) => {
      body3D.latest = props;
      return <div role="img" aria-label={props.label} />;
    },
  };
});

// How many times the 3D module had been read by the time every import of this file had run, which a static import
// of it from the figure would have made one.
const loadsAtImport = body3D.loads;

const label = "Body map, Actual, heat, front.";
const FIRST_FRAME_TIMEOUT_MILLISECONDS = 8000;

// The 3D body is read through import(), so it is given the time that takes before it is said not to be there.
async function settle() {
  await act(async () => {
    await vi.dynamicImportSettled();
  });
}

function renderView(extra: Partial<React.ComponentProps<typeof BodyView>> = {}) {
  return render(
    <BodyView label={label} scale="heat" side="front" values={{ abs: 3 }} w={145} {...extra} />,
  );
}

async function renderIn3D(extra: Partial<React.ComponentProps<typeof BodyView>> = {}) {
  window.localStorage.setItem("bodyMap.renderer", "3d");
  renderView(extra);
  await waitFor(() => {
    expect(body3D.latest).not.toBeNull();
  });
}

function latestBody3D(): Body3DProps {
  if (body3D.latest === null) {
    throw new Error("The 3D body was not drawn.");
  }
  return body3D.latest;
}

describe("BodyView", () => {
  beforeEach(() => {
    window.localStorage.clear();
    body3D.latest = null;
    resetBodyMapRendererForTests();
    resetBodyFigureForTests();
    resetBody3DSupportForTests();
    stubWebGL({ available: true });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("on 2D", () => {
    it("should not read the 3D module just because a figure imports BodyView", () => {
      expect(loadsAtImport).toBe(0);
    });

    it("should draw the 2D figure, named by its label, and never draw the 3D body", async () => {
      renderView();
      await settle();

      expect(screen.getByRole("img", { name: label })).toBeTruthy();
      expect(body3D.latest).toBeNull();
    });

    it("should not even make a canvas to ask whether the browser has WebGL", () => {
      const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext");

      renderView();

      expect(getContext).not.toHaveBeenCalled();
    });

    it("should not draw the 3D body when 3D is chosen but the figure is female", async () => {
      window.localStorage.setItem("bodyMap.renderer", "3d");

      renderView({ body: "female" });
      await settle();

      expect(screen.getByRole("img", { name: label })).toBeTruthy();
      expect(body3D.latest).toBeNull();
    });

    it("should not draw the 3D body when 3D is chosen but the browser has no WebGL", async () => {
      stubWebGL({ available: false });
      window.localStorage.setItem("bodyMap.renderer", "3d");

      renderView();
      await settle();

      expect(screen.getByRole("img", { name: label })).toBeTruthy();
      expect(body3D.latest).toBeNull();
    });
  });

  describe("on 3D", () => {
    it("should give the context it made for the probe back at once", () => {
      const loseContext = vi.fn();
      stubWebGL({ available: true, loseContext });
      window.localStorage.setItem("bodyMap.renderer", "3d");

      renderView();

      expect(loseContext).toHaveBeenCalledTimes(1);
    });

    it("should draw the 2D figure at once, named as loading, and the 3D body over it once it is read", async () => {
      await renderIn3D();

      expect(screen.getByRole("img", { name: describeBodyFigureLoading3d(label) })).toBeTruthy();
      expect(screen.queryByRole("img", { name: label })).toBeNull();
    });

    it("should hand the 3D body the figure's value props, the side and the width", async () => {
      await renderIn3D({ scale: "volume", side: "back", selected: "abs", unselectedOpacity: 0.4 });

      expect(latestBody3D()).toMatchObject({
        scale: "volume",
        side: "back",
        selected: "abs",
        unselectedOpacity: 0.4,
        values: { abs: 3 },
        w: 145,
      });
    });

    it("should hand on the touch and zoom calls to the 3D body alone", async () => {
      const onTap = vi.fn();
      const onLongPressMuscle = vi.fn();
      await renderIn3D({ onTap, onLongPressMuscle, onZoomChange: vi.fn(), touchWidth: 400 });

      expect(latestBody3D().onTap).toBe(onTap);
      expect(latestBody3D().onLongPressMuscle).toBe(onLongPressMuscle);
      expect(latestBody3D().touchWidth).toBe(400);
      // The 2D figure that shows while it loads makes no muscle a button.
      expect(screen.queryAllByRole("button")).toEqual([]);
    });

    it("should show the 3D body, and hide the 2D figure from a screen reader, on its first frame", async () => {
      await renderIn3D();

      act(() => {
        latestBody3D().onFirstFrame?.();
      });

      expect(screen.getByRole("img", { name: label })).toBeTruthy();
      expect(screen.queryByRole("img", { name: describeBodyFigureLoading3d(label) })).toBeNull();
    });

    it("should tell the caller where the 3D body is in drawing", async () => {
      const onPhaseChange = vi.fn();
      await renderIn3D({ onPhaseChange });

      expect(onPhaseChange).toHaveBeenLastCalledWith("loading");
      act(() => {
        latestBody3D().onFirstFrame?.();
      });
      expect(onPhaseChange).toHaveBeenLastCalledWith("drawn");
    });

    it("should fade the 2D figure out over the standard duration, or at once under reduced motion", async () => {
      await renderIn3D();
      act(() => {
        latestBody3D().onFirstFrame?.();
      });

      const figure = screen
        .getAllByRole("img", { name: label, hidden: true })
        .find((image) => image.tagName.toLowerCase() === "svg");
      const fadingLayer = figure?.parentElement;
      expect(fadingLayer?.getAttribute("aria-hidden")).toBe("true");
      expect(fadingLayer?.className).toContain("duration-standard");
      expect(fadingLayer?.className).toContain("motion-reduce:transition-none");
    });
  });

  describe("when 3D cannot draw", () => {
    it("should keep the 2D figure, say nothing and stay on 2D when the 3D body reports an error", async () => {
      const onPhaseChange = vi.fn();
      await renderIn3D({ onPhaseChange });

      act(() => {
        latestBody3D().onError?.();
      });

      expect(screen.getByRole("img", { name: label })).toBeTruthy();
      expect(screen.queryByRole("status")).toBeNull();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(onPhaseChange).toHaveBeenLastCalledWith("failed");
    });

    it("should stay on 2D for the rest of the visit, for every figure drawn after", async () => {
      await renderIn3D();
      act(() => {
        latestBody3D().onError?.();
      });
      cleanup();
      body3D.latest = null;

      renderView();
      await act(async () => {
        await vi.dynamicImportSettled();
      });

      expect(screen.getByRole("img", { name: label })).toBeTruthy();
      expect(body3D.latest).toBeNull();
    });

    it("should keep the 2D figure after 8 seconds with no first frame, and say nothing", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      window.localStorage.setItem("bodyMap.renderer", "3d");
      const onPhaseChange = vi.fn();
      renderView({ onPhaseChange });
      await act(async () => {
        await vi.dynamicImportSettled();
      });

      act(() => {
        vi.advanceTimersByTime(FIRST_FRAME_TIMEOUT_MILLISECONDS - 1);
      });
      expect(onPhaseChange).toHaveBeenLastCalledWith("loading");

      act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(onPhaseChange).toHaveBeenLastCalledWith("failed");
      expect(screen.getByRole("img", { name: label })).toBeTruthy();
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("should not fall back once the first frame has drawn", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      window.localStorage.setItem("bodyMap.renderer", "3d");
      const onPhaseChange = vi.fn();
      renderView({ onPhaseChange });
      await act(async () => {
        await vi.dynamicImportSettled();
      });
      act(() => {
        latestBody3D().onFirstFrame?.();
      });

      act(() => {
        vi.advanceTimersByTime(FIRST_FRAME_TIMEOUT_MILLISECONDS * 2);
      });

      expect(onPhaseChange).toHaveBeenLastCalledWith("drawn");
    });
  });

  describe("at hydration", () => {
    it("should draw 2D on the server with 3D saved, hydrate with no mismatch, and then load 3D", async () => {
      window.localStorage.setItem("bodyMap.renderer", "3d");
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const container = document.createElement("div");
      document.body.appendChild(container);
      const view = <BodyView label={label} scale="heat" side="front" values={{ abs: 3 }} w={145} />;
      container.innerHTML = renderToString(view);

      expect(container.querySelector("svg")?.getAttribute("aria-label")).toBe(label);

      await act(async () => {
        hydrateRoot(container, view);
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(body3D.latest).not.toBeNull();
      });

      expect(consoleError).not.toHaveBeenCalled();
      container.remove();
    });
  });
});
