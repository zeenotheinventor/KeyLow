import {
  HISTORY_EMPTY,
  HISTORY_ERROR,
  HISTORY_LOADING_NAME,
  HISTORY_LOAD_EARLIER_FAILED,
  HISTORY_SCREEN,
  HISTORY_TABLE,
  TRAIN_START_FAILED,
} from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  earlierHistoryWeek,
  goldenHistoryWeek,
  historyBackend,
  historySession,
  historyWeeks,
  renderWithHistory,
  resetHistoryBackend,
} from "./historyBackend";
import { THURSDAY_1755 } from "./support";

import { HistoryScreen } from "@/components/train";
import { ToastProvider } from "@/components/ui/Toast";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const THIS_WEEK = "This week · Mon 12 to Sun 18 Oct";
const LAST_WEEK = "Last week · Mon 5 to Sun 11 Oct";

const renderHistory = () =>
  renderWithHistory(
    <ToastProvider>
      <HistoryScreen />
    </ToastProvider>,
  );

// A session row is a row of the table that is not the column headings and not a week's heading.
const sessionRows = () =>
  screen
    .getAllByRole("row")
    .filter((row) => within(row).queryAllByRole("columnheader").length === 0)
    .map((row) => row.textContent);

describe("the history page", () => {
  beforeEach(() => {
    resetHistoryBackend();
    router.push.mockReset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(THURSDAY_1755);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    act(() => {
      onlineManager.setOnline(true);
    });
  });

  describe("with the golden week and the week before it", () => {
    beforeEach(() => {
      historyBackend.sessions = [...goldenHistoryWeek, ...earlierHistoryWeek];
    });

    it("should be titled History", async () => {
      renderHistory();

      expect(screen.getByRole("heading", { level: 1, name: HISTORY_SCREEN.title })).toBeTruthy();
      await screen.findByRole("table");
    });

    it("should draw one table of sessions with the board's five columns", async () => {
      renderHistory();

      const section = await screen.findByRole("region", { name: HISTORY_TABLE.sectionName });
      const headings = within(within(section).getByRole("table")).getAllByRole("columnheader");
      expect(headings.map((heading) => heading.textContent)).toEqual([
        "Date",
        "Session",
        "Time",
        "Sets",
        "Muscles",
      ]);
    });

    it("should head each week with its name and total, over its sessions newest first", async () => {
      renderHistory();

      await screen.findByRole("row", { name: new RegExp(THIS_WEEK) });
      expect(sessionRows()).toEqual([
        `${THIS_WEEK}3 sessions · 41 sets`,
        "Thu 15 OctLegs30 min8Hamstrings, quads, glutes",
        "Tue 13 OctPull51 min17Lats, biceps, mid traps",
        "Mon 12 OctPush48 min16Triceps, front delts, side delts",
        `${LAST_WEEK}4 sessions · 63 sets`,
        "Sat 10 OctPush50 min16Triceps, front delts, side delts",
        "Thu 8 OctLegs56 min16Hamstrings, quads, glutes",
        "Tue 6 OctPull49 min15Lats, biceps, mid traps",
        "Mon 5 OctPush47 min16Triceps, front delts, side delts",
      ]);
    });

    it("should open a session's detail from its name in the table", async () => {
      renderHistory();

      const pull = await screen.findByRole("link", {
        name: "Pull, Tue 13 October, 51 minutes · 17 sets, open session",
      });
      expect(pull.getAttribute("href")).toBe(
        `/train/history/${String(goldenHistoryWeek[1]?.["id"])}`,
      );
      expect(screen.getAllByRole("link")).toHaveLength(7);
      expect(screen.queryAllByRole("button")).toHaveLength(0);
    });

    it("should offer no earlier weeks when there are none", async () => {
      renderHistory();

      await screen.findByRole("row", { name: new RegExp(LAST_WEEK) });
      expect(screen.queryByRole("button", { name: HISTORY_SCREEN.loadEarlierAction })).toBeNull();
    });
  });

  describe("when the newest week with a session is last week", () => {
    beforeEach(() => {
      historyBackend.sessions = [...earlierHistoryWeek];
    });

    it("should name that week Last week, since the name comes from today and not from the week's place in the list", async () => {
      renderHistory();

      expect(await screen.findByRole("row", { name: new RegExp(LAST_WEEK) })).toBeTruthy();
      expect(screen.queryByRole("row", { name: /^This week/ })).toBeNull();
    });
  });

  describe("with a session that was started and never ended", () => {
    beforeEach(() => {
      historyBackend.sessions = [
        ...goldenHistoryWeek.slice(0, 2),
        historySession({
          localDate: "2026-10-15",
          dayName: "Legs",
          kind: "legs",
          minutes: null,
          workingSets: 8,
        }),
        ...earlierHistoryWeek,
      ];
    });

    it("should draw it once, in its week and its newest first place, as In progress with its sets", async () => {
      renderHistory();

      await screen.findByRole("row", { name: new RegExp(THIS_WEEK) });
      expect(sessionRows().slice(0, 4)).toEqual([
        `${THIS_WEEK}3 sessions · 41 sets`,
        "Thu 15 OctLegsIn progress8Hamstrings, quads, glutes",
        "Tue 13 OctPull51 min17Lats, biceps, mid traps",
        "Mon 12 OctPush48 min16Triceps, front delts, side delts",
      ]);
    });

    it("should mark its time with the In progress badge, in the Time column", async () => {
      renderHistory();

      const row = await screen.findByRole("row", { name: /^Thu 15 Oct/ });
      const cell = within(row).getByRole("cell", { name: "In progress" });
      const badge = within(cell).getByText("In progress");
      // The accent badge is the one kit pill that tints its fill with the accent.
      expect(badge).not.toBe(cell);
      expect(badge.className).toContain("bg-accent-muted");
      expect(within(row).getByRole("cell", { name: "8" })).toBeTruthy();
    });

    it("should link it to the session page, where the finished rows link to their detail", async () => {
      renderHistory();

      const link = await screen.findByRole("link", {
        name: "Legs, Thu 15 October, 8 sets, in progress, resume session",
      });
      expect(link.getAttribute("href")).toBe("/train/session");
      expect(
        screen
          .getAllByRole("link")
          .filter((other) => other.getAttribute("href") === "/train/session"),
      ).toHaveLength(1);
    });
  });

  describe("with more weeks than it loads at first", () => {
    beforeEach(() => {
      historyBackend.sessions = historyWeeks("2026-10-12", 4);
    });

    const loadEarlier = () =>
      screen.getByRole("button", { name: HISTORY_SCREEN.loadEarlierAction });
    const weekHeadings = () => screen.getAllByRole("row", { name: / to Sun / });

    it("should load two weeks, then the next earlier week each time Load earlier weeks is pressed", async () => {
      renderHistory();

      await screen.findByRole("row", { name: new RegExp(LAST_WEEK) });
      expect(weekHeadings()).toHaveLength(2);

      await userEvent.click(loadEarlier());

      await waitFor(() => {
        expect(weekHeadings()).toHaveLength(3);
      });
      expect(screen.getByRole("row", { name: /Mon 28 Sep to Sun 4 Oct/ })).toBeTruthy();
    });

    it("should take Load earlier weeks away once the oldest week is shown", async () => {
      renderHistory();
      await screen.findByRole("row", { name: new RegExp(LAST_WEEK) });

      await userEvent.click(loadEarlier());
      await waitFor(() => {
        expect(weekHeadings()).toHaveLength(3);
      });
      await userEvent.click(loadEarlier());

      await waitFor(() => {
        expect(weekHeadings()).toHaveLength(4);
      });
      expect(screen.queryByRole("button", { name: HISTORY_SCREEN.loadEarlierAction })).toBeNull();
    });

    it("should show a danger toast that states the rule, and keep the weeks, when the earlier week does not load", async () => {
      renderHistory();
      await screen.findByRole("row", { name: new RegExp(LAST_WEEK) });
      historyBackend.failing = true;

      await userEvent.click(loadEarlier());

      expect(await screen.findByText(HISTORY_LOAD_EARLIER_FAILED)).toBeTruthy();
      expect(weekHeadings()).toHaveLength(2);
      expect(loadEarlier().hasAttribute("disabled")).toBe(false);
    });

    it("should dim Load earlier weeks while offline, since the earlier weeks are not saved", async () => {
      renderHistory();
      await screen.findByRole("row", { name: new RegExp(THIS_WEEK) });

      act(() => {
        onlineManager.setOnline(false);
      });

      expect(loadEarlier().hasAttribute("disabled")).toBe(true);
    });
  });

  describe("with nothing logged", () => {
    it("should say there are no sessions yet, in place of the table", async () => {
      renderHistory();

      expect(await screen.findByRole("heading", { name: HISTORY_EMPTY.title })).toBeTruthy();
      expect(screen.getByText(HISTORY_EMPTY.body)).toBeTruthy();
      expect(screen.queryByRole("table")).toBeNull();
    });

    it("should start a session that follows no routine day, in the profile's zone, from Start a session, and open it", async () => {
      renderHistory();

      await userEvent.click(await screen.findByRole("button", { name: HISTORY_EMPTY.action }));

      await waitFor(() => {
        expect(router.push).toHaveBeenCalledWith("/train/session");
      });
      expect(historyBackend.startedSessions).toHaveLength(1);
      expect(historyBackend.startedSessions[0]).toMatchObject({ routine_day_id: null });
    });

    it("should dim Start a session offline, since a start needs a connection", async () => {
      renderHistory();
      const start = await screen.findByRole("button", { name: HISTORY_EMPTY.action });

      act(() => {
        onlineManager.setOnline(false);
      });

      expect(start.hasAttribute("disabled")).toBe(true);
    });

    it("should say the session did not start, and open nothing, when the start does not go through", async () => {
      historyBackend.failingStart = true;
      renderHistory();

      await userEvent.click(await screen.findByRole("button", { name: HISTORY_EMPTY.action }));

      expect(await screen.findByText(TRAIN_START_FAILED)).toBeTruthy();
      expect(router.push).not.toHaveBeenCalled();
    });
  });

  describe("while the history loads", () => {
    it("should show a status named for the loading, and no table", async () => {
      historyBackend.hung = true;
      renderHistory();

      expect(await screen.findByRole("status", { name: HISTORY_LOADING_NAME })).toBeTruthy();
      expect(screen.queryByRole("table")).toBeNull();
      expect(screen.queryByRole("heading", { name: HISTORY_EMPTY.title })).toBeNull();
    });
  });

  describe("offline with nothing saved", () => {
    it("should say the history did not load, with no Try again, instead of loading for ever", async () => {
      historyBackend.sessions = [...goldenHistoryWeek];
      act(() => {
        onlineManager.setOnline(false);
      });
      renderHistory();

      const alert = await screen.findByRole("alert");
      expect(within(alert).getByRole("heading", { name: HISTORY_ERROR.title })).toBeTruthy();
      expect(screen.queryByRole("button", { name: HISTORY_ERROR.action })).toBeNull();
      expect(screen.queryByRole("status", { name: HISTORY_LOADING_NAME })).toBeNull();
    });

    it("should offer Try again once the connection is back", async () => {
      act(() => {
        onlineManager.setOnline(false);
      });
      renderHistory();
      await screen.findByRole("alert");

      act(() => {
        onlineManager.setOnline(true);
      });

      expect(await screen.findByRole("heading", { name: HISTORY_EMPTY.title })).toBeTruthy();
    });
  });

  describe("when the history does not load", () => {
    beforeEach(() => {
      historyBackend.sessions = [...goldenHistoryWeek, ...earlierHistoryWeek];
      historyBackend.failing = true;
    });

    it("should say so under the title, with words that state the rule", async () => {
      renderHistory();

      const alert = await screen.findByRole("alert");
      expect(within(alert).getByRole("heading", { name: HISTORY_ERROR.title })).toBeTruthy();
      expect(within(alert).getByText(HISTORY_ERROR.body)).toBeTruthy();
      expect(screen.getByRole("heading", { level: 1, name: HISTORY_SCREEN.title })).toBeTruthy();
      expect(screen.queryByRole("table")).toBeNull();
    });

    it("should read again from Try again, and show the table once the read works", async () => {
      renderHistory();
      const retry = await screen.findByRole("button", { name: HISTORY_ERROR.action });
      historyBackend.failing = false;
      await userEvent.click(retry);

      expect(await screen.findByRole("table")).toBeTruthy();
    });
  });
});
