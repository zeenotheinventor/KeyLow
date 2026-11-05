import { BODY_MAP, describeBodyFigureLoading3d } from "@keylow/core/copy";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubWebGL } from "../support/webgl";

import type { Body3DProps } from "@/components/ui/Body3D";

import { BodyStage } from "@/components/body/BodyMapFigures/BodyStage";
import { resetBody3DSupportForTests } from "@/components/body/BodyView/testing";
import { resetBodyMapRendererForTests } from "@/lib/bodyMapRenderer/testing";

// jsdom has no WebGL, so the 3D body is stood in for. The tests say when it has drawn, failed or zoomed, as it would.
const body3D = vi.hoisted((): { latest: Body3DProps | null } => ({ latest: null }));

vi.mock("@/components/ui/Body3D", () => ({
  Body3D: (props: Body3DProps) => {
    body3D.latest = props;
    return <div role="img" aria-label={props.label} />;
  },
}));

const label = "Body map, Actual, heat, front.";

function latestBody3D(): Body3DProps {
  if (body3D.latest === null) {
    throw new Error("The 3D body was not drawn.");
  }
  return body3D.latest;
}

async function renderStage(extra: Partial<React.ComponentProps<typeof BodyStage>> = {}) {
  window.localStorage.setItem("bodyMap.renderer", "3d");
  const onSideChange = vi.fn();
  const rendered = render(
    <BodyStage
      label={label}
      scale="heat"
      side="front"
      values={{ abs: 3 }}
      onSideChange={onSideChange}
      {...extra}
    />,
  );
  await waitFor(() => {
    expect(body3D.latest).not.toBeNull();
  });
  return { ...rendered, onSideChange };
}

function draw() {
  act(() => {
    latestBody3D().onFirstFrame?.();
  });
}

function zoomTo(zoom: number) {
  act(() => {
    latestBody3D().onZoomChange?.(zoom);
  });
}

const zoomGroup = () => screen.getByRole("group", { name: BODY_MAP.zoom.groupName });
const zoomIn = () => within(zoomGroup()).getByRole("button", { name: BODY_MAP.zoom.in });
const zoomOut = () => within(zoomGroup()).getByRole("button", { name: BODY_MAP.zoom.out });

describe("BodyStage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    body3D.latest = null;
    resetBodyMapRendererForTests();
    resetBody3DSupportForTests();
    stubWebGL({ available: true });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe("while the 3D body loads", () => {
    it("should draw the 2D figure, named as loading, with Loading 3D… at the corner", async () => {
      await renderStage();

      expect(screen.getByRole("img", { name: describeBodyFigureLoading3d(label) })).toBeTruthy();
      expect(screen.getByRole("status").textContent).toBe(BODY_MAP.loading3d);
    });

    it("should leave the stage clear and the zoom buttons off", async () => {
      const { container } = await renderStage();

      expect(container.querySelector(".bg-stage-background")?.className).toContain("opacity-0");
      expect(zoomIn()).toHaveProperty("disabled", true);
      expect(zoomOut()).toHaveProperty("disabled", true);
    });

    it("should say how to use it, in the web's hint", async () => {
      await renderStage();

      expect(screen.getByText(BODY_MAP.rotateHintWeb)).toBeTruthy();
    });
  });

  describe("once the 3D body has drawn", () => {
    it("should take the loading line away and darken the stage over the standard duration", async () => {
      const { container } = await renderStage();

      draw();

      expect(screen.queryByRole("status")).toBeNull();
      const backdrop = container.querySelector(".bg-stage-background");
      expect(backdrop?.className).toContain("opacity-100");
      expect(backdrop?.className).toContain("duration-standard");
    });

    it("should darken the stage at once under reduced motion", async () => {
      const { container } = await renderStage();

      draw();

      expect(container.querySelector(".bg-stage-background")?.className).toContain(
        "motion-reduce:transition-none",
      );
    });

    it("should turn the zoom buttons on, with Zoom out off at the whole body", async () => {
      await renderStage();

      draw();

      expect(zoomIn()).toHaveProperty("disabled", false);
      expect(zoomOut()).toHaveProperty("disabled", true);
    });
  });

  describe("zoom", () => {
    it("should step the 3D body closer, one step for each press of Zoom in", async () => {
      await renderStage();
      draw();
      expect(latestBody3D().zoomInCount ?? 0).toBe(0);

      fireEvent.click(zoomIn());
      fireEvent.click(zoomIn());

      expect(latestBody3D().zoomInCount).toBe(2);
    });

    it("should step the 3D body back with Zoom out once it is zoomed", async () => {
      await renderStage();
      draw();
      zoomTo(1.5);

      fireEvent.click(zoomOut());

      expect(latestBody3D().zoomOutCount).toBe(1);
    });

    it("should turn Zoom in off at the closest zoom", async () => {
      await renderStage();
      draw();

      zoomTo(2);

      expect(zoomIn()).toHaveProperty("disabled", true);
      expect(zoomOut()).toHaveProperty("disabled", false);
    });

    it("should show the zoom and a Reset button while zoomed, and neither at the whole body", async () => {
      await renderStage();
      draw();
      expect(screen.queryByRole("button", { name: BODY_MAP.zoom.resetName })).toBeNull();

      zoomTo(2);

      expect(screen.getByText("2×")).toBeTruthy();
      expect(screen.getByRole("button", { name: BODY_MAP.zoom.resetName })).toBeTruthy();

      zoomTo(1);

      expect(screen.queryByText("1×")).toBeNull();
      expect(screen.queryByRole("button", { name: BODY_MAP.zoom.resetName })).toBeNull();
    });

    it("should ease back to the whole body when Reset is pressed", async () => {
      await renderStage();
      draw();
      zoomTo(1.5);

      fireEvent.click(screen.getByRole("button", { name: BODY_MAP.zoom.resetName }));

      expect(latestBody3D().zoomResetCount).toBe(1);
    });
  });

  describe("keyboard focus in the zoom controls", () => {
    it("should move focus to Zoom out when Zoom in turns off at the closest zoom", async () => {
      await renderStage();
      draw();
      zoomIn().focus();

      fireEvent.click(zoomIn());
      zoomTo(2);

      expect(zoomIn()).toHaveProperty("disabled", true);
      expect(document.activeElement).toBe(zoomOut());
    });

    it("should move focus to Zoom in when Zoom out turns off at the whole body", async () => {
      await renderStage();
      draw();
      zoomTo(1.5);
      zoomOut().focus();

      fireEvent.click(zoomOut());
      zoomTo(1);

      expect(zoomOut()).toHaveProperty("disabled", true);
      expect(document.activeElement).toBe(zoomIn());
    });

    it("should move focus to Zoom in when Reset takes itself away", async () => {
      await renderStage();
      draw();
      zoomTo(1.5);
      const reset = screen.getByRole("button", { name: BODY_MAP.zoom.resetName });
      reset.focus();

      fireEvent.click(reset);
      zoomTo(1);

      expect(screen.queryByRole("button", { name: BODY_MAP.zoom.resetName })).toBeNull();
      expect(document.activeElement).toBe(zoomIn());
    });

    it("should leave focus where it is when a press does not turn a button off", async () => {
      await renderStage();
      draw();
      zoomIn().focus();

      fireEvent.click(zoomIn());
      zoomTo(1.5);

      expect(document.activeElement).toBe(zoomIn());
    });

    it("should not take focus from elsewhere when a pinch changes the zoom after a press that turned nothing off", async () => {
      await renderStage();
      draw();
      zoomIn().focus();
      fireEvent.click(zoomIn());
      zoomTo(1.5);
      screen.getByRole("radio", { name: BODY_MAP.sideSwitch.back }).focus();

      zoomTo(2);

      expect(document.activeElement).toBe(
        screen.getByRole("radio", { name: BODY_MAP.sideSwitch.back }),
      );
    });
  });

  describe("the side", () => {
    it("should offer Front and Back in a group named Side shown, on the side it was given", async () => {
      await renderStage({ side: "back" });

      expect(screen.getByRole("radiogroup", { name: BODY_MAP.sideSwitch.name })).toBeTruthy();
      expect(screen.getByRole("radio", { name: BODY_MAP.sideSwitch.back })).toHaveProperty(
        "checked",
        true,
      );
      expect(latestBody3D().side).toBe("back");
    });

    it("should tell the caller when Back is pressed", async () => {
      const { onSideChange } = await renderStage();

      fireEvent.click(screen.getByRole("radio", { name: BODY_MAP.sideSwitch.back }));

      expect(onSideChange).toHaveBeenCalledWith("back");
    });

    it("should hand the 3D body's own turn to the caller", async () => {
      const { onSideChange } = await renderStage();

      act(() => {
        latestBody3D().onSideChange?.("back");
      });

      expect(onSideChange).toHaveBeenCalledWith("back");
    });
  });

  describe("when 3D cannot draw", () => {
    async function renderFailed(extra: Partial<React.ComponentProps<typeof BodyStage>> = {}) {
      const rendered = await renderStage(extra);
      act(() => {
        latestBody3D().onError?.();
      });
      return rendered;
    }

    it("should keep the 2D figure, say nothing and keep the stage clear", async () => {
      const { container } = await renderFailed();

      expect(screen.getByRole("img", { name: label })).toBeTruthy();
      expect(screen.queryByRole("status")).toBeNull();
      expect(container.querySelector(".bg-stage-background")?.className).toContain("opacity-0");
    });

    it("should keep the zoom buttons off and Front and Back working", async () => {
      const { onSideChange } = await renderFailed();

      expect(zoomIn()).toHaveProperty("disabled", true);
      fireEvent.click(screen.getByRole("radio", { name: BODY_MAP.sideSwitch.back }));
      expect(onSideChange).toHaveBeenCalledWith("back");
    });

    it("should stay clear on a stage drawn after the failure, with no report to wait for", async () => {
      await renderFailed();
      cleanup();

      const { container } = render(
        <BodyStage label={label} scale="heat" side="front" values={{}} onSideChange={vi.fn()} />,
      );

      expect(container.querySelector(".bg-stage-background")?.className).toContain("opacity-0");
      expect(screen.queryByRole("status")).toBeNull();
    });
  });

  describe("a press on the figure", () => {
    it("should call onTap for a click on the 2D figure while the 3D body has not drawn", async () => {
      const onTap = vi.fn();
      await renderStage({ onTap });

      fireEvent.click(screen.getByRole("img", { name: describeBodyFigureLoading3d(label) }));

      expect(onTap).toHaveBeenCalledTimes(1);
    });

    it("should call onTap for a click on the 2D figure that stays after a failure", async () => {
      const onTap = vi.fn();
      await renderStage({ onTap });
      act(() => {
        latestBody3D().onError?.();
      });

      fireEvent.click(screen.getByRole("img", { name: label }));

      expect(onTap).toHaveBeenCalledTimes(1);
    });

    it("should give the 2D figure that stays after a failure a button for each muscle, a short click on one is a tap and a hold opens it", async () => {
      const onTap = vi.fn();
      const onLongPressMuscle = vi.fn();
      await renderStage({ onTap, onLongPressMuscle });
      expect(screen.queryAllByRole("button", { name: /^Abs/ })).toEqual([]);
      act(() => {
        latestBody3D().onError?.();
      });

      const abs = screen.getByRole("button", { name: /^Abs/ });
      fireEvent.click(abs);
      expect(onTap).toHaveBeenCalledTimes(1);
      fireEvent.keyDown(abs, { key: "Enter" });
      expect(onLongPressMuscle).toHaveBeenCalledWith("abs");
    });

    it("should not call onTap for a drag that ends in a click on the 2D figure", async () => {
      const onTap = vi.fn();
      await renderStage({ onTap });
      const figure = screen.getByRole("img", { name: describeBodyFigureLoading3d(label) });

      fireEvent.mouseDown(figure, { clientX: 10, clientY: 10 });
      fireEvent.click(figure, { clientX: 60, clientY: 10 });

      expect(onTap).not.toHaveBeenCalled();
    });

    it("should leave the press to the 3D body once it has drawn, so it is not a tap twice", async () => {
      const onTap = vi.fn();
      await renderStage({ onTap });
      draw();

      fireEvent.click(screen.getByRole("img", { name: label }));

      expect(onTap).not.toHaveBeenCalled();
      expect(latestBody3D().onTap).toBe(onTap);
    });

    it("should hand the 3D body no tap when there is none, as on Gap", async () => {
      await renderStage();
      draw();

      expect(latestBody3D().onTap).toBeUndefined();
    });
  });
});
