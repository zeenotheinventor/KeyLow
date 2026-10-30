import { BODY_MAP } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { goldenThursdayBodyMap } from "./bodyMapFixtures";

import type {
  DashboardBodyMap as DashboardBodyMapData,
  TrainingReadResult,
} from "@keylow/api-client";

import { DashboardBodyMap } from "@/components/dashboard/DashboardBodyMap";

type BodyMapRead = TrainingReadResult<DashboardBodyMapData>;

const reads = vi.hoisted((): { current: unknown; nows: string[] } => ({
  current: undefined,
  nows: [],
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useDashboardBodyMap: ({ now }: { now: string }) => {
    reads.nows.push(now);
    return reads.current;
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
    show(pending);
  });

  afterEach(() => {
    cleanup();
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
});
