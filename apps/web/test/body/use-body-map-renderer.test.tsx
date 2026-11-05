import { act, cleanup, renderHook, within } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBodyMapRenderer } from "@/lib/bodyMapRenderer";
import { resetBodyMapRendererForTests } from "@/lib/bodyMapRenderer/testing";

// The key the phone saves it under, so the two stores name the setting alike.
const STORAGE_KEY = "bodyMap.renderer";

function Probe() {
  const { renderer, isReady } = useBodyMapRenderer();
  return <p role="status">{isReady ? renderer : "not read"}</p>;
}

describe("useBodyMapRenderer", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetBodyMapRendererForTests();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("should be 2D, ready, when nothing is saved", () => {
    const { result } = renderHook(() => useBodyMapRenderer());

    expect(result.current).toMatchObject({ renderer: "2d", isReady: true });
  });

  it("should be the renderer saved", () => {
    window.localStorage.setItem(STORAGE_KEY, "3d");

    const { result } = renderHook(() => useBodyMapRenderer());

    expect(result.current).toMatchObject({ renderer: "3d", isReady: true });
  });

  it("should be 2D when the value saved is not a renderer", () => {
    window.localStorage.setItem(STORAGE_KEY, "4d");

    const { result } = renderHook(() => useBodyMapRenderer());

    expect(result.current).toMatchObject({ renderer: "2d", isReady: true });
  });

  it("should be 2D, with no error, when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    const { result } = renderHook(() => useBodyMapRenderer());

    expect(result.current).toMatchObject({ renderer: "2d", isReady: true });
  });

  it("should save a choice", () => {
    const { result } = renderHook(() => useBodyMapRenderer());

    act(() => {
      result.current.setRenderer("3d");
    });

    expect(result.current.renderer).toBe("3d");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("3d");
  });

  it("should change every reader at once", () => {
    const setting = renderHook(() => useBodyMapRenderer());
    const bodyMap = renderHook(() => useBodyMapRenderer());

    act(() => {
      setting.result.current.setRenderer("3d");
    });

    expect(bodyMap.result.current.renderer).toBe("3d");
  });

  it("should keep a choice for the visit when it cannot be saved", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    const { result } = renderHook(() => useBodyMapRenderer());

    act(() => {
      result.current.setRenderer("3d");
    });

    expect(result.current.renderer).toBe("3d");
  });

  describe("on the server and at hydration", () => {
    it("should not read storage on the server, so the renderer is not known there", () => {
      window.localStorage.setItem(STORAGE_KEY, "3d");
      const getItem = vi.spyOn(Storage.prototype, "getItem");

      const page = document.createElement("div");
      page.innerHTML = renderToString(<Probe />);

      expect(within(page).getByRole("status").textContent).toBe("not read");
      expect(getItem).not.toHaveBeenCalled();
    });

    it("should hydrate a page the server drew with 3D saved, with no mismatch, and then show it", async () => {
      window.localStorage.setItem(STORAGE_KEY, "3d");
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const container = document.createElement("div");
      document.body.appendChild(container);
      container.innerHTML = renderToString(<Probe />);

      await act(async () => {
        hydrateRoot(container, <Probe />);
        await Promise.resolve();
      });

      expect(consoleError).not.toHaveBeenCalled();
      expect(container.textContent).toBe("3d");
      container.remove();
    });
  });
});
