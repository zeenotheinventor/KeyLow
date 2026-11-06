import { act, cleanup, renderHook, within } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetWeightChartViewForTests, useWeightChartView } from "@/lib/weightChartView";

// The keys the phone saves the same two choices under, so the two stores name them alike.
const VIEW_KEY = "weight.chartView";
const UNIT_KEY = "weight.compositionUnit";

function Probe() {
  const { view, unit } = useWeightChartView();
  return <p role="status">{`${view} in ${unit}`}</p>;
}

describe("useWeightChartView", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetWeightChartViewForTests();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("should be Weight in kg when nothing is saved", () => {
    const { result } = renderHook(() => useWeightChartView());

    expect(result.current).toMatchObject({ view: "weight", unit: "kg" });
  });

  it("should be the view and the unit saved", () => {
    window.localStorage.setItem(VIEW_KEY, "composition");
    window.localStorage.setItem(UNIT_KEY, "pct");

    const { result } = renderHook(() => useWeightChartView());

    expect(result.current).toMatchObject({ view: "composition", unit: "pct" });
  });

  it("should fall back to Weight in kg for values that are not choices", () => {
    window.localStorage.setItem(VIEW_KEY, "bars");
    window.localStorage.setItem(UNIT_KEY, "lb");

    const { result } = renderHook(() => useWeightChartView());

    expect(result.current).toMatchObject({ view: "weight", unit: "kg" });
  });

  it("should be Weight in kg, with no error, when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    const { result } = renderHook(() => useWeightChartView());

    expect(result.current).toMatchObject({ view: "weight", unit: "kg" });
  });

  it("should save the view and the unit as two separate choices", () => {
    const { result } = renderHook(() => useWeightChartView());

    act(() => {
      result.current.setView("composition");
    });

    expect(result.current).toMatchObject({ view: "composition", unit: "kg" });
    expect(window.localStorage.getItem(VIEW_KEY)).toBe("composition");
    expect(window.localStorage.getItem(UNIT_KEY)).toBeNull();

    act(() => {
      result.current.setUnit("pct");
    });

    expect(result.current).toMatchObject({ view: "composition", unit: "pct" });
    expect(window.localStorage.getItem(UNIT_KEY)).toBe("pct");
  });

  it("should change every reader at once", () => {
    const card = renderHook(() => useWeightChartView());
    const section = renderHook(() => useWeightChartView());

    act(() => {
      card.result.current.setView("composition");
    });

    expect(section.result.current.view).toBe("composition");
  });

  it("should keep a choice for the visit when it cannot be saved", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    const { result } = renderHook(() => useWeightChartView());

    act(() => {
      result.current.setUnit("pct");
    });

    expect(result.current.unit).toBe("pct");
  });

  it("should give a render the same answer until a choice is made", () => {
    const { result, rerender } = renderHook(() => useWeightChartView());
    const first = result.current;

    rerender();

    expect(result.current.view).toBe(first.view);
    expect(result.current.setView).toBe(first.setView);
  });

  describe("on the server and at hydration", () => {
    it("should not read storage on the server, so the first draw is Weight in kg", () => {
      window.localStorage.setItem(VIEW_KEY, "composition");
      window.localStorage.setItem(UNIT_KEY, "pct");
      const getItem = vi.spyOn(Storage.prototype, "getItem");

      const page = document.createElement("div");
      page.innerHTML = renderToString(<Probe />);

      expect(within(page).getByRole("status").textContent).toBe("weight in kg");
      expect(getItem).not.toHaveBeenCalled();
    });

    it("should hydrate a page the server drew with Composition saved, with no mismatch, and then show it", async () => {
      window.localStorage.setItem(VIEW_KEY, "composition");
      window.localStorage.setItem(UNIT_KEY, "pct");
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const container = document.createElement("div");
      document.body.appendChild(container);
      container.innerHTML = renderToString(<Probe />);

      await act(async () => {
        hydrateRoot(container, <Probe />);
        await Promise.resolve();
      });

      expect(consoleError).not.toHaveBeenCalled();
      expect(container.textContent).toBe("composition in pct");
      container.remove();
    });
  });
});
