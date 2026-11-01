import { BODY_MAP } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { goldenThursdayBodyMap, goldenThursdayVolumeBodyMap } from "./bodyMapFixtures";

import type {
  DashboardBodyMap as DashboardBodyMapData,
  TrainingReadResult,
} from "@keylow/api-client";

import { DashboardBodyMap } from "@/components/dashboard/DashboardBodyMap";
import { resetDashboardBodyScaleForTests } from "@/lib/useDashboardBodyScale";

type BodyMapRead = TrainingReadResult<DashboardBodyMapData>;

// What the hook gives, for each chart it is asked for. A read with no chart of its own gives `current`.
const reads = vi.hoisted(
  (): {
    current: unknown;
    byScale: Record<string, unknown>;
    nows: string[];
    scales: unknown[];
  } => ({
    current: undefined,
    byScale: {},
    nows: [],
    scales: [],
  }),
);

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useDashboardBodyMap: ({ now, scale }: { now: string; scale?: string }) => {
    reads.nows.push(now);
    reads.scales.push(scale);
    return (scale === undefined ? undefined : reads.byScale[scale]) ?? reads.current;
  },
}));

const refetch = () => Promise.resolve();
const pending: BodyMapRead = {
  data: undefined,
  isPending: true,
  isError: false,
  error: null,
  refetch,
};
const failed: BodyMapRead = {
  data: undefined,
  isPending: false,
  isError: true,
  error: new Error("read failed"),
  refetch,
};
const loaded: BodyMapRead = {
  data: goldenThursdayBodyMap,
  isPending: false,
  isError: false,
  error: null,
  refetch,
};

function show(read: BodyMapRead) {
  reads.current = read;
}

const FIRST_LINE = /^Body map, Actual heat now\. Warmest: lats 25 percent/;

describe("DashboardBodyMap", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"],
    });
    // 17:55 in London on Thursday 15 October 2026.
    vi.setSystemTime(new Date("2026-10-15T16:55:00Z"));
    onlineManager.setOnline(true);
    reads.nows = [];
    reads.scales = [];
    reads.byScale = {};
    show(pending);
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    resetDashboardBodyScaleForTests();
    vi.useRealTimers();
    onlineManager.setOnline(true);
  });

  it("should ask for the heat at the time on the clock", () => {
    render(<DashboardBodyMap />);

    expect(reads.nows.at(-1)).toBe("2026-10-15T16:55:00.000Z");
  });

  it("should show the card once the rows are read", () => {
    show(loaded);
    render(<DashboardBodyMap />);

    expect(screen.getByRole("link", { name: FIRST_LINE })).toBeTruthy();
  });

  it("should keep the numbers on screen when the browser goes offline", () => {
    show(loaded);
    onlineManager.setOnline(false);
    render(<DashboardBodyMap />);

    expect(screen.getByRole("link", { name: FIRST_LINE })).toBeTruthy();
  });

  it("should keep the numbers on screen when a refetch fails", () => {
    show({ ...loaded, isError: true, error: new Error("refetch failed") });
    render(<DashboardBodyMap />);

    expect(screen.getByRole("link", { name: FIRST_LINE })).toBeTruthy();
    expect(screen.queryByText(BODY_MAP.dashboardCard.loadFailed)).toBeNull();
  });

  describe("while the rows are on their way", () => {
    it("should be a status named for what is loading", () => {
      render(<DashboardBodyMap />);

      expect(
        screen.getByRole("status", { name: BODY_MAP.dashboardCard.loadingLabel }),
      ).toBeTruthy();
      expect(screen.queryByRole("region")).toBeNull();
    });
  });

  describe("when a read fails", () => {
    it("should say so in a quiet line, with no figure and no Try again", () => {
      show(failed);
      render(<DashboardBodyMap />);

      expect(screen.getByText(BODY_MAP.dashboardCard.loadFailed)).toBeTruthy();
      expect(screen.queryAllByRole("img", { hidden: true })).toHaveLength(0);
      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
    });
  });

  describe("offline with nothing read", () => {
    it("should say the body map is not available offline, and not load for ever", () => {
      onlineManager.setOnline(false);
      render(<DashboardBodyMap />);

      expect(screen.getByText(BODY_MAP.dashboardCard.offlineUnavailable)).toBeTruthy();
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("should load again when the connection returns", () => {
      onlineManager.setOnline(false);
      render(<DashboardBodyMap />);

      act(() => {
        onlineManager.setOnline(true);
      });

      expect(
        screen.getByRole("status", { name: BODY_MAP.dashboardCard.loadingLabel }),
      ).toBeTruthy();
    });
  });

  describe("under the Dashboard chart setting", () => {
    const loadedVolume: BodyMapRead = { ...loaded, data: goldenThursdayVolumeBodyMap };

    beforeEach(() => {
      reads.byScale = { heat: loaded, volume: loadedVolume };
    });

    it("should ask for heat and draw the heat card when nothing is saved", () => {
      render(<DashboardBodyMap />);

      expect(reads.scales.at(-1)).toBe("heat");
      expect(screen.getByRole("link", { name: FIRST_LINE })).toBeTruthy();
      expect(screen.getByRole("img", { name: "Heat legend", hidden: true })).toBeTruthy();
    });

    it("should ask for the week's volume and draw the volume card when Weekly volume is saved", () => {
      window.localStorage.setItem("bodyMap.dashboardScale", "volume");

      render(<DashboardBodyMap />);

      expect(reads.scales.at(-1)).toBe("volume");
      expect(screen.getByRole("link", { name: /weekly sets this week/ })).toBeTruthy();
      expect(screen.getByRole("img", { name: "Volume legend", hidden: true })).toBeTruthy();
      expect(screen.queryByRole("img", { name: "Heat legend", hidden: true })).toBeNull();
    });

    it("should fall back to heat when what is saved is not a chart", () => {
      window.localStorage.setItem("bodyMap.dashboardScale", "weekly");

      render(<DashboardBodyMap />);

      expect(reads.scales.at(-1)).toBe("heat");
      expect(screen.getByRole("link", { name: FIRST_LINE })).toBeTruthy();
    });
  });
});
