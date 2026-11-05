import { act, cleanup, renderHook, within } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDashboardBodyChart } from "@/lib/dashboardBodyChart";
import { resetDashboardBodyChartForTests } from "@/lib/dashboardBodyChart/testing";

// The key the phone saves it under, so the two stores name the setting alike.
const STORAGE_KEY = "dashboard.bodyChart";

function Probe() {
  const { chart, isReady } = useDashboardBodyChart();
  return <p role="status">{isReady ? chart : "not read"}</p>;
}

describe("useDashboardBodyChart", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetDashboardBodyChartForTests();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("should be Heat, ready, when nothing is saved", () => {
    const { result } = renderHook(() => useDashboardBodyChart());

    expect(result.current).toMatchObject({ chart: "heat", isReady: true });
  });

  it("should be the chart saved", () => {
    window.localStorage.setItem(STORAGE_KEY, "volume");

    const { result } = renderHook(() => useDashboardBodyChart());

    expect(result.current).toMatchObject({ chart: "volume", isReady: true });
  });

  it("should be Heat when the value saved is not a chart", () => {
    window.localStorage.setItem(STORAGE_KEY, "gap");

    const { result } = renderHook(() => useDashboardBodyChart());

    expect(result.current).toMatchObject({ chart: "heat", isReady: true });
  });

  it("should be Heat, with no error, when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    const { result } = renderHook(() => useDashboardBodyChart());

    expect(result.current).toMatchObject({ chart: "heat", isReady: true });
  });

  it("should save a choice", () => {
    const { result } = renderHook(() => useDashboardBodyChart());

    act(() => {
      result.current.setChart("volume");
    });

    expect(result.current.chart).toBe("volume");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("volume");
  });

  it("should change every reader at once", () => {
    const setting = renderHook(() => useDashboardBodyChart());
    const dashboard = renderHook(() => useDashboardBodyChart());

    act(() => {
      setting.result.current.setChart("volume");
    });

    expect(dashboard.result.current.chart).toBe("volume");
  });

  it("should keep a choice for the visit when it cannot be saved", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    const { result } = renderHook(() => useDashboardBodyChart());

    act(() => {
      result.current.setChart("volume");
    });

    expect(result.current.chart).toBe("volume");
  });

  describe("on the server and at hydration", () => {
    it("should not read storage on the server, so the chart is not known there", () => {
      window.localStorage.setItem(STORAGE_KEY, "volume");
      const getItem = vi.spyOn(Storage.prototype, "getItem");

      const page = document.createElement("div");
      page.innerHTML = renderToString(<Probe />);

      expect(within(page).getByRole("status").textContent).toBe("not read");
      expect(getItem).not.toHaveBeenCalled();
    });

    it("should hydrate a page the server drew with Weekly volume saved, with no mismatch, and then show it", async () => {
      window.localStorage.setItem(STORAGE_KEY, "volume");
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const container = document.createElement("div");
      document.body.appendChild(container);
      container.innerHTML = renderToString(<Probe />);

      await act(async () => {
        hydrateRoot(container, <Probe />);
        await Promise.resolve();
      });

      expect(consoleError).not.toHaveBeenCalled();
      expect(container.textContent).toBe("volume");
      container.remove();
    });
  });
});
