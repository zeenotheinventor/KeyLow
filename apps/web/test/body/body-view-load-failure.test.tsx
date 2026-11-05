import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubWebGL } from "../support/webgl";

import { BodyView } from "@/components/body/BodyView";
import { resetBody3DSupportForTests } from "@/components/body/BodyView/testing";
import { resetBodyMapRendererForTests } from "@/lib/bodyMapRenderer/testing";

// The 3D code is a file the browser fetches on first use, and offline with it not cached the fetch rejects, which React
// raises where the 3D body would draw, as a render that throws does. jsdom cannot make the fetch itself fail, so the
// stand-in throws as it draws, and the fetch failing is proved in a real browser.
vi.mock("@/components/ui/Body3D", () => ({
  Body3D: (): never => {
    throw new Error("Failed to fetch dynamically imported module");
  },
}));

const label = "Body map, Actual, heat, front.";

describe("BodyView when the 3D body throws or its code is unavailable", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("bodyMap.renderer", "3d");
    resetBodyMapRendererForTests();
    resetBody3DSupportForTests();
    stubWebGL({ available: true });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("should fall back to the 2D figure at once, with no message and no hang", async () => {
    const onPhaseChange = vi.fn();
    render(
      <BodyView
        label={label}
        scale="heat"
        side="front"
        values={{}}
        w={145}
        onPhaseChange={onPhaseChange}
      />,
    );

    await waitFor(() => {
      expect(onPhaseChange).toHaveBeenCalledWith("failed");
    });

    expect(screen.getByRole("img", { name: label })).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("should stay on 2D for the rest of the visit", async () => {
    const onFirstPhaseChange = vi.fn();
    const first = render(
      <BodyView
        label={label}
        scale="heat"
        side="front"
        values={{}}
        w={145}
        onPhaseChange={onFirstPhaseChange}
      />,
    );
    await waitFor(() => {
      expect(onFirstPhaseChange).toHaveBeenCalledWith("failed");
    });
    first.unmount();

    const onPhaseChange = vi.fn();
    render(
      <BodyView
        label={label}
        scale="heat"
        side="front"
        values={{}}
        w={145}
        onPhaseChange={onPhaseChange}
      />,
    );

    expect(onPhaseChange).not.toHaveBeenCalled();
    expect(screen.getByRole("img", { name: label })).toBeTruthy();
  });
});
