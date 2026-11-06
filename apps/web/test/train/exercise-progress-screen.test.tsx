import {
  EXERCISE_PROGRESS,
  GENERIC_ERROR,
  RETRY_LABEL,
  TRAIN_ERROR,
  TRAIN_OFFLINE_NOTHING_SAVED,
  TRAIN_OFFLINE_TITLE,
} from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  goldenBenchSets,
  progressBackend,
  progressSet,
  renderWithProgress,
  resetProgressBackend,
} from "./progressBackend";

import { ExerciseProgressScreen } from "@/components/train";

// 11:00 in London on Tuesday 20 October 2026. This week starts on Monday 19 October.
const TUESDAY_1100 = new Date("2026-10-20T10:00:00Z");
const SUMMARY = "Bench press, 13 weeks, from 55 kg to 62.5 kg";
const LATEST_ROW = "Mon 19 Oct, 62.5 kg for 6 reps, +2.5 kg";
const FALL_ROW = "Mon 5 Oct, 60 kg for 8 reps, −2 reps";

// The chart measures the box its column gives it, so the test says what that box is.
function stubWidth(width: number) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    () => new DOMRect(0, 0, width, 100),
  );
}

const renderProgress = () =>
  renderWithProgress(<ExerciseProgressScreen exerciseId={progressBackend.exercise.id} />);

const weeksList = () => screen.getByRole("region", { name: EXERCISE_PROGRESS.weeksHeading });

describe("the exercise progress page", () => {
  beforeEach(() => {
    resetProgressBackend();
    progressBackend.sets = goldenBenchSets();
    stubWidth(754);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(TUESDAY_1100);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    act(() => {
      onlineManager.setOnline(true);
    });
  });

  describe("with the golden bench", () => {
    it("should name the exercise in the title and link back to Routines", async () => {
      renderProgress();

      expect(await screen.findByRole("heading", { level: 1, name: "Bench press" })).toBeTruthy();
      expect(
        screen.getByRole("link", { name: EXERCISE_PROGRESS.backLabel }).getAttribute("href"),
      ).toBe("/train/routines");
    });

    it("should be plainly titled while the exercise is not read", () => {
      progressBackend.hung = true;

      renderProgress();

      expect(
        screen.getByRole("heading", { level: 1, name: EXERCISE_PROGRESS.fallbackTitle }),
      ).toBeTruthy();
      expect(screen.getByRole("status", { name: EXERCISE_PROGRESS.loadingName })).toBeTruthy();
    });

    it("should open on 3 months with the Range control over the chart", async () => {
      renderProgress();

      const range = await screen.findByRole("radiogroup", { name: EXERCISE_PROGRESS.rangeLabel });
      expect(
        within(range)
          .getAllByRole<HTMLInputElement>("radio")
          .map((radio) => [radio.value, radio.checked]),
      ).toEqual([
        ["4w", false],
        ["3m", true],
        ["1y", false],
      ]);
    });

    it("should draw the chart named by its summary, in the exercise's unit", async () => {
      renderProgress();

      expect(await screen.findByRole("img", { name: SUMMARY })).toBeTruthy();
      expect(screen.getByText("kg")).toBeTruthy();
    });

    it("should list the weeks newest first, with 62.5 kg for 6 reps and +2.5 kg on top", async () => {
      renderProgress();

      await screen.findByRole("img", { name: SUMMARY });
      const rows = within(weeksList()).getAllByRole("listitem");

      expect(rows).toHaveLength(13);
      expect(rows[0]?.textContent).toBe("Mon 19 Oct62.5 kg for 6 reps+2.5 kg");
    });

    it("should show the skipped week as Not trained, and not as a button", async () => {
      renderProgress();

      await screen.findByRole("img", { name: SUMMARY });

      const row = within(weeksList()).getByText("Not trained").closest("li");
      expect(row?.textContent).toBe("Mon 12 OctNot trained");
      expect(within(weeksList()).queryByRole("button", { name: /Mon 12 Oct/ })).toBeNull();
    });

    it("should select a week's point and raise its row when the row is pressed", async () => {
      renderProgress();
      await screen.findByRole("img", { name: SUMMARY });

      await userEvent.click(within(weeksList()).getByRole("button", { name: FALL_ROW }));

      expect(
        within(weeksList()).getByRole("button", { name: FALL_ROW }).getAttribute("aria-pressed"),
      ).toBe("true");
      expect(screen.getByRole("button", { name: "5 Oct" }).getAttribute("aria-pressed")).toBe(
        "true",
      );
      expect(screen.getByRole("button", { name: "19 Oct" }).getAttribute("aria-pressed")).toBe(
        "false",
      );
    });

    it("should raise a week's row when its point on the chart is pressed", async () => {
      renderProgress();
      await screen.findByRole("img", { name: SUMMARY });

      await userEvent.click(screen.getByRole("button", { name: "5 Oct" }));

      expect(
        within(weeksList()).getByRole("button", { name: FALL_ROW }).getAttribute("aria-pressed"),
      ).toBe("true");
      expect(
        within(weeksList()).getByRole("button", { name: LATEST_ROW }).getAttribute("aria-pressed"),
      ).toBe("false");
    });

    it("should keep the selected week when the range changes to one that holds it", async () => {
      renderProgress();
      await screen.findByRole("img", { name: SUMMARY });
      await userEvent.click(within(weeksList()).getByRole("button", { name: FALL_ROW }));

      await userEvent.click(screen.getByRole("radio", { name: "1 year" }));

      await waitFor(() => {
        expect(
          within(weeksList()).getByRole("button", { name: FALL_ROW }).getAttribute("aria-pressed"),
        ).toBe("true");
      });
    });

    it("should read a shorter range and list only its weeks", async () => {
      renderProgress();
      await screen.findByRole("img", { name: SUMMARY });

      await userEvent.click(screen.getByRole("radio", { name: "4 weeks" }));

      await waitFor(() => {
        expect(within(weeksList()).getAllByRole("listitem")).toHaveLength(4);
      });
      expect(screen.getByRole<HTMLInputElement>("radio", { name: "4 weeks" }).checked).toBe(true);
    });

    it("should keep the weeks on show while a longer range is read", async () => {
      renderProgress();
      await screen.findByRole("img", { name: SUMMARY });
      await userEvent.click(screen.getByRole("radio", { name: "4 weeks" }));
      await waitFor(() => {
        expect(within(weeksList()).getAllByRole("listitem")).toHaveLength(4);
      });
      progressBackend.hung = true;

      await userEvent.click(screen.getByRole("radio", { name: "1 year" }));

      expect(within(weeksList()).getAllByRole("listitem")).toHaveLength(4);
      expect(screen.queryByRole("status", { name: EXERCISE_PROGRESS.loadingName })).toBeNull();
    });

    it("should write loads in pounds for a profile that trains in pounds", async () => {
      progressBackend.weightUnit = "lb";

      renderProgress();

      expect(
        await screen.findByRole("button", { name: /^Mon 19 Oct, 137\.8 lb for 6 reps/ }),
      ).toBeTruthy();
      expect(screen.getByText("lb")).toBeTruthy();
    });
  });

  describe("with one trained week", () => {
    beforeEach(() => {
      progressBackend.sets = [progressSet("2026-10-19", 60, 8)];
    });

    it("should say a second week is needed, over the value that reads First week", async () => {
      renderProgress();
      await userEvent.click(await screen.findByRole("radio", { name: "4 weeks" }));

      expect(await screen.findByText(EXERCISE_PROGRESS.secondWeekNeeded)).toBeTruthy();
      expect(within(weeksList()).getByText("First week")).toBeTruthy();
    });
  });

  describe("while the first read is going", () => {
    it("should stand in six list rows from the large breakpoint and three under it", async () => {
      progressBackend.hung = true;

      renderProgress();

      // CSS is not applied here, so each set of rows is found by the class that shows it. A skeleton draws
      // nothing for its first 200 ms.
      const rowsOf = (hiddenClass: string) =>
        screen
          .getAllByRole("status", { hidden: true })
          .find((status) => status.classList.contains(hiddenClass))?.firstElementChild
          ?.childElementCount;
      await waitFor(() => {
        expect(rowsOf("max-lg:hidden")).toBe(6);
      });
      expect(rowsOf("lg:hidden")).toBe(3);
    });
  });

  describe("with an address that is not an exercise id", () => {
    it("should show the error state with Try again, never a skeleton", async () => {
      renderWithProgress(<ExerciseProgressScreen exerciseId="not-a-uuid" />);

      expect(await screen.findByRole("alert")).toBeTruthy();
      expect(screen.getByText(GENERIC_ERROR)).toBeTruthy();
      expect(screen.getByRole("button", { name: RETRY_LABEL })).toBeTruthy();
      expect(screen.queryByRole("status", { name: EXERCISE_PROGRESS.loadingName })).toBeNull();
    });
  });

  describe("with nothing trained in the range", () => {
    beforeEach(() => {
      progressBackend.sets = [];
    });

    it("should show the empty state in the place of the chart and the weeks, with Range kept", async () => {
      renderProgress();

      expect(
        await screen.findByRole("heading", { name: EXERCISE_PROGRESS.empty.title }),
      ).toBeTruthy();
      expect(screen.getByText(EXERCISE_PROGRESS.empty.body)).toBeTruthy();
      expect(screen.getByRole("radiogroup", { name: EXERCISE_PROGRESS.rangeLabel })).toBeTruthy();
      expect(screen.queryByRole("img")).toBeNull();
      expect(screen.queryByRole("region", { name: EXERCISE_PROGRESS.weeksHeading })).toBeNull();
    });
  });

  describe("when the read fails", () => {
    beforeEach(() => {
      progressBackend.failing = true;
    });

    it("should show the error state with Try again, Range kept, and read again on a press", async () => {
      renderProgress();
      expect(await screen.findByRole("alert")).toBeTruthy();
      expect(screen.getByText(GENERIC_ERROR)).toBeTruthy();
      expect(screen.getByRole("radiogroup", { name: EXERCISE_PROGRESS.rangeLabel })).toBeTruthy();
      progressBackend.failing = false;

      await userEvent.click(screen.getByRole("button", { name: RETRY_LABEL }));

      expect(await screen.findByRole("img", { name: SUMMARY })).toBeTruthy();
    });
  });

  describe("offline", () => {
    it("should not wait for a connection when nothing was read, and offer no Try again", async () => {
      act(() => {
        onlineManager.setOnline(false);
      });

      renderProgress();

      expect(await screen.findByText(TRAIN_ERROR.title)).toBeTruthy();
      expect(screen.getByText(TRAIN_ERROR.body)).toBeTruthy();
      expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
      expect(screen.queryByRole("status", { name: EXERCISE_PROGRESS.loadingName })).toBeNull();
      expect(
        screen.getByRole("heading", { level: 1, name: EXERCISE_PROGRESS.fallbackTitle }),
      ).toBeTruthy();
      const banner = screen.getByRole("status");
      expect(within(banner).getByText(TRAIN_OFFLINE_TITLE)).toBeTruthy();
      expect(within(banner).getByText(TRAIN_OFFLINE_NOTHING_SAVED)).toBeTruthy();
      expect(screen.getByRole("radiogroup", { name: EXERCISE_PROGRESS.rangeLabel })).toBeTruthy();
    });

    it("should show the rows already read under a banner that says when they were read", async () => {
      renderProgress();
      await screen.findByRole("img", { name: SUMMARY });

      act(() => {
        onlineManager.setOnline(false);
      });

      const banner = await screen.findByRole("status");
      expect(within(banner).getByText(TRAIN_OFFLINE_TITLE)).toBeTruthy();
      expect(banner.textContent).toContain("Showing your training as saved at 11:00.");
      expect(screen.getByRole("img", { name: SUMMARY })).toBeTruthy();
      expect(within(weeksList()).getAllByRole("listitem")).toHaveLength(13);
    });

    it("should say nothing was read for a range that was never read, and not wait for it", async () => {
      renderProgress();
      await screen.findByRole("img", { name: SUMMARY });
      act(() => {
        onlineManager.setOnline(false);
      });

      await userEvent.click(screen.getByRole("radio", { name: "1 year" }));

      expect(await screen.findByText(TRAIN_ERROR.title)).toBeTruthy();
      expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
      expect(screen.queryByRole("img", { name: SUMMARY })).toBeNull();
    });
  });
});
