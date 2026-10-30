import { act, cleanup, renderHook, within } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBodyFigure } from "@/lib/bodyFigure";
import { resetBodyFigureForTests } from "@/lib/bodyFigure/testing";

function Probe() {
  const { figure, isReady, hasChosen } = useBodyFigure();
  return (
    <p role="status">
      {isReady ? `${figure}, ${hasChosen ? "chosen" : "not chosen"}` : "not read"}
    </p>
  );
}

describe("useBodyFigure", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetBodyFigureForTests();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("should be Male, ready and not yet chosen on a first visit", () => {
    const { result } = renderHook(() => useBodyFigure());

    expect(result.current).toMatchObject({ figure: "male", isReady: true, hasChosen: false });
  });

  it("should be the figure stored, chosen", () => {
    window.localStorage.setItem("bodyMap.figure", "female");

    const { result } = renderHook(() => useBodyFigure());

    expect(result.current).toMatchObject({ figure: "female", isReady: true, hasChosen: true });
  });

  it("should store a choice and count it as chosen", () => {
    const { result } = renderHook(() => useBodyFigure());

    act(() => {
      result.current.setFigure("female");
    });

    expect(result.current).toMatchObject({ figure: "female", hasChosen: true });
    expect(window.localStorage.getItem("bodyMap.figure")).toBe("female");
  });

  it("should change every screen that reads it at once", () => {
    const first = renderHook(() => useBodyFigure());
    const second = renderHook(() => useBodyFigure());

    act(() => {
      first.result.current.setFigure("female");
    });

    expect(second.result.current.figure).toBe("female");
  });

  it("should keep a choice for the visit when it cannot be saved", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    const { result } = renderHook(() => useBodyFigure());

    act(() => {
      result.current.setFigure("female");
    });

    expect(result.current).toMatchObject({ figure: "female", hasChosen: true });
  });

  it("should be Male and chosen when storage is blocked, with no error", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    const { result } = renderHook(() => useBodyFigure());

    expect(result.current).toMatchObject({ figure: "male", isReady: true, hasChosen: true });
  });

  describe("on the server and at hydration", () => {
    it("should not read the stored figure on the server", () => {
      window.localStorage.setItem("bodyMap.figure", "female");
      const getItem = vi.spyOn(Storage.prototype, "getItem");

      const page = document.createElement("div");
      page.innerHTML = renderToString(<Probe />);

      expect(within(page).getByRole("status").textContent).toBe("not read");
      expect(getItem).not.toHaveBeenCalled();
    });

    it("should hydrate a page the server drew with Female stored, with no mismatch, and then show Female", async () => {
      window.localStorage.setItem("bodyMap.figure", "female");
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const container = document.createElement("div");
      document.body.appendChild(container);
      container.innerHTML = renderToString(<Probe />);

      await act(async () => {
        hydrateRoot(container, <Probe />);
        await Promise.resolve();
      });

      expect(consoleError).not.toHaveBeenCalled();
      expect(container.textContent).toBe("female, chosen");
      container.remove();
    });
  });
});
