import {
  EXERCISE_PROGRESS,
  GENERIC_ERROR,
  RETRY_LABEL,
  ROUTINE_PROGRESS,
  ROUTINES_SCREEN,
  TRAIN_ERROR,
} from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BENCH_ID,
  FACE_PULL_ID,
  fullBody,
  pushPullLegs,
  renderWithRoutines,
  resetRoutinesBackend,
  routinesBackend,
  seedGoldenProgress,
  upperLower,
} from "./routinesBackend";

import type { RoutinesScreenProps } from "@/components/train/RoutinesScreen";

import { RoutinesScreen } from "@/components/train/RoutinesScreen";

// 11:00 in London on Tuesday 20 October 2026. This week starts on Monday 19 October.
const TUESDAY_1100 = new Date("2026-10-20T10:00:00Z");
const BENCH_ROW = "Bench press, 62.5 kg for 6 reps, up 2.5 kg on the last trained week";
const INCLINE_ROW =
  "Incline dumbbell press, 27.5 kg for 10 reps, down 2.5 kg on the last trained week";

const renderScreen = (props: RoutinesScreenProps = {}) =>
  renderWithRoutines(<RoutinesScreen {...props} />);

const findSection = () => screen.findByRole("region", { name: ROUTINE_PROGRESS.heading });

/** The section once its rows are in. */
async function findRows() {
  const section = await findSection();
  await within(section).findAllByRole("region", { name: "Pull" });
  return section;
}

describe("the Progress section of the routines page", () => {
  beforeEach(() => {
    resetRoutinesBackend();
    routinesBackend.routines = [pushPullLegs, upperLower, fullBody];
    seedGoldenProgress();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(TUESDAY_1100);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    act(() => {
      onlineManager.setOnline(true);
    });
  });

  describe("for the golden Push Pull Legs", () => {
    it("should head the section Progress, over a group for each day of the routine in its order", async () => {
      renderScreen();

      const section = await findRows();

      expect(
        within(section)
          .getAllByRole("heading", { level: 2 })
          .map((heading) => heading.textContent),
      ).toEqual([ROUTINE_PROGRESS.heading, "Push", "Pull", "Push"]);
    });

    it("should give the bench row its full line and a rise of 2.5 kg, in both Push days, as the phone does", async () => {
      renderScreen();

      const section = await findRows();

      const benchRows = within(section).getAllByRole("link", { name: BENCH_ROW });
      expect(benchRows).toHaveLength(2);
      for (const row of benchRows) {
        expect(within(row).getByText("62.5 kg for 6 reps")).toBeTruthy();
        expect(within(row).getByText("+2.5 kg")).toBeTruthy();
      }
      const [firstPush, , secondPush] = within(section).getAllByRole("region", {
        name: /Push|Pull/,
      });
      expect(
        within(firstPush ?? section)
          .getAllByRole("link")
          .map((row) => row.getAttribute("aria-label")),
      ).toEqual([BENCH_ROW, INCLINE_ROW]);
      expect(
        within(secondPush ?? section)
          .getAllByRole("link")
          .map((row) => row.getAttribute("aria-label")),
      ).toEqual([BENCH_ROW, INCLINE_ROW]);
    });

    it("should say a fall in words and sign, and an exercise never trained without a change", async () => {
      renderScreen();

      const section = await findRows();

      const [incline] = within(section).getAllByRole("link", { name: INCLINE_ROW });
      expect(within(incline ?? section).getByText("−2.5 kg")).toBeTruthy();
      const facePull = within(section).getByRole("link", {
        name: "Face pull, not trained yet",
      });
      expect(within(facePull).getByText("Not trained yet")).toBeTruthy();
      expect(within(facePull).queryByText(/kg$|reps?$/)).toBeNull();
    });

    it("should say not trained this week, with the last value, when this week is a gap", async () => {
      routinesBackend.trendSets = routinesBackend.trendSets.filter(
        (set) =>
          !(
            set["exercise_id"] === BENCH_ID &&
            (set["workout_sessions"] as { local_date: string }).local_date === "2026-10-19"
          ),
      );
      renderScreen();

      const section = await findRows();

      const [bench] = within(section).getAllByRole("link", {
        name: "Bench press, not trained this week, last 60 kg for 8 reps",
      });
      expect(within(bench ?? section).getByText(/Not trained this week/)).toBeTruthy();
      expect(within(bench ?? section).queryByText(/^[+−]/)).toBeNull();
    });

    it("should write every load in pounds for a profile that trains in pounds", async () => {
      routinesBackend.weightUnit = "lb";
      renderScreen();

      const section = await findRows();

      expect(
        within(section).getAllByRole("link", {
          name: "Bench press, 137.8 lb for 6 reps, up 5.5 lb on the last trained week",
        }),
      ).toHaveLength(2);
      expect(within(section).queryByText(/\bkg\b/)).toBeNull();
    });

    it("should link each row to the exercise's progress page by its id alone", async () => {
      renderScreen();

      const section = await findRows();

      const benchLinks = within(section).getAllByRole("link", { name: BENCH_ROW });
      expect(benchLinks.map((link) => link.getAttribute("href"))).toEqual([
        `/train/progress/${BENCH_ID}`,
        `/train/progress/${BENCH_ID}`,
      ]);
      expect(
        within(section)
          .getByRole("link", { name: "Face pull, not trained yet" })
          .getAttribute("href"),
      ).toBe(`/train/progress/${FACE_PULL_ID}`);
      expect(within(section).queryByRole("button")).toBeNull();
    });

    it("should read the routine and its sets once each, never one read for each exercise", async () => {
      renderScreen();
      await findRows();

      const reads = routinesBackend.progressRequests.filter(
        ({ table }) => table === "workout_sets" || table === "routines",
      );
      expect(reads.map(({ table }) => table)).toEqual(["routines", "workout_sets", "workout_sets"]);
    });
  });

  describe("while it loads", () => {
    it("should name the wait in place of the groups, with the list already drawn", async () => {
      routinesBackend.hangingReads.add("workout_sets");

      renderScreen();

      const section = await findSection();
      expect(
        await within(section).findByRole("status", { name: EXERCISE_PROGRESS.loadingName }),
      ).toBeTruthy();
      expect(screen.getByRole("heading", { name: "Push Pull Legs" })).toBeTruthy();
      expect(within(section).queryByRole("region")).toBeNull();
    });
  });

  describe("when it fails online", () => {
    it("should show the generic error with Try again in place of the groups, and read again on Try again", async () => {
      routinesBackend.failingReads.add("workout_sets");
      renderScreen();

      const section = await findSection();
      const alert = await within(section).findByRole("alert");
      expect(within(alert).getByText(GENERIC_ERROR)).toBeTruthy();
      expect(within(section).queryByRole("region")).toBeNull();

      routinesBackend.failingReads.delete("workout_sets");
      await userEvent.click(within(alert).getByRole("button", { name: RETRY_LABEL }));

      await within(section).findAllByRole("region", { name: "Pull" });
      expect(within(section).queryByRole("alert")).toBeNull();
    });

    it("should read the routine again on Try again when the routine's own read failed", async () => {
      routinesBackend.failingReads.add("routine");
      renderScreen();

      const section = await findSection();
      const alert = await within(section).findByRole("alert");
      expect(within(alert).getByText(GENERIC_ERROR)).toBeTruthy();

      routinesBackend.failingReads.delete("routine");
      await userEvent.click(within(alert).getByRole("button", { name: RETRY_LABEL }));

      await within(section).findAllByRole("region", { name: "Pull" });
      expect(within(section).queryByRole("alert")).toBeNull();
    });
  });

  describe("offline", () => {
    it("should keep showing what the visit has read, with no error", async () => {
      renderScreen();
      const section = await findRows();

      act(() => {
        onlineManager.setOnline(false);
      });

      expect(within(section).getAllByRole("region", { name: "Push" })).toHaveLength(2);
      expect(within(section).queryByText(TRAIN_ERROR.title)).toBeNull();
    });

    it("should say nothing was read, with no button and no skeleton, when a read is not held", async () => {
      // The visit read the list and the routine, then lost the sets and the connection.
      routinesBackend.hangingReads.add("workout_sets");
      const first = renderScreen();
      await findSection();
      await vi.waitFor(() => {
        expect(routinesBackend.progressRequests.some(({ table }) => table === "workout_sets")).toBe(
          true,
        );
      });
      cleanup();
      await first.queryClient.cancelQueries();
      act(() => {
        onlineManager.setOnline(false);
      });

      renderWithRoutines(<RoutinesScreen />, { queryClient: first.queryClient });

      const section = await findSection();
      expect(await within(section).findByText(TRAIN_ERROR.title)).toBeTruthy();
      expect(within(section).getByText(TRAIN_ERROR.body)).toBeTruthy();
      expect(within(section).queryByRole("button")).toBeNull();
      expect(within(section).queryByRole("status")).toBeNull();
    });
  });

  describe("when there is nothing to show", () => {
    it("should draw no section, and read nothing for it, with no active routine", async () => {
      routinesBackend.routines = [upperLower, fullBody];

      renderScreen();

      await screen.findByRole("region", { name: ROUTINES_SCREEN.otherSectionName });
      expect(screen.queryByRole("heading", { name: ROUTINE_PROGRESS.heading })).toBeNull();
      expect(
        routinesBackend.progressRequests.filter(
          ({ table, search }) => table !== "profiles" || search.includes("weight_unit"),
        ),
      ).toEqual([]);
    });

    it("should draw no section for an active routine with no exercise", async () => {
      routinesBackend.details = {};

      renderScreen();

      await screen.findByRole("region", { name: ROUTINES_SCREEN.otherSectionName });
      await vi.waitFor(() => {
        expect(routinesBackend.progressRequests.some(({ table }) => table === "routines")).toBe(
          true,
        );
      });
      // The section is its heading and a skeleton until the answer comes, so wait for it to go.
      await vi.waitFor(() => {
        expect(screen.queryByRole("heading", { name: ROUTINE_PROGRESS.heading })).toBeNull();
      });
    });
  });
});
