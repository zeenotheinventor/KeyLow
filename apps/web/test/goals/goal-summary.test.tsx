import { GOAL_ERRORS, GOAL_SUMMARY } from "@keylow/core/copy";
import { MUSCLE_IDS } from "@keylow/core/training";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fillClassOf,
  goldenAnswers,
  releaseRoutineReads,
  renderGoalSummary,
  resetSummaryBackend,
  summaryBackend,
} from "./summarySupport";

import type { MuscleId } from "@keylow/core/training";

import { resetBodyFigureForTests } from "@/lib/bodyFigure/testing";

const router = vi.hoisted(() => ({
  push: vi.fn<(href: string) => void>(),
  replace: vi.fn<(href: string) => void>(),
  back: vi.fn<() => void>(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const ANSWERS_LINE =
  "From your answers: look better, V-taper, 4 days a week, 60 minutes, full gym, intermediate.";
const FIRST_ROW = "Side delts, lats and upper chest come first";
const KEPT_UP_ROW = "Everything else in your routine is kept up";
const NO_ROUTINE_NOT_TARGETED_ROW =
  "Upper traps, abs, obliques, side glutes, adductors, shins and neck get no direct work";
const FIT_ROW = "4 days a week, about 60 minutes, full gym";
const LEGEND = "Gold muscles come first, blue ones are kept up. Grey ones are not targeted.";

const saveButton = () => screen.findByRole("button", { name: GOAL_SUMMARY.saveAction });
const frontFigure = () => screen.findByRole("img", { name: GOAL_SUMMARY.bodyMapFrontName });

// The swatch is decoration with no role, so it is found as the sibling before the row's words.
const swatchClassOf = (rowTitle: string): string =>
  screen.getByText(rowTitle).parentElement?.previousElementSibling?.getAttribute("class") ?? "";

beforeEach(() => {
  resetSummaryBackend();
  resetBodyFigureForTests();
  window.localStorage.clear();
  router.push.mockReset();
  router.replace.mockReset();
  router.back.mockReset();
});

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
});

describe("the priorities summary for the golden answers", () => {
  it("should draw the board: title, answers, rows, legend and Save goal", async () => {
    // The golden week's routine works every muscle but the obliques, which is what leaves them out.
    summaryBackend.routineMuscles = MUSCLE_IDS.filter((muscle) => muscle !== "obliques");
    renderGoalSummary();

    expect(await screen.findByRole("heading", { level: 1, name: GOAL_SUMMARY.title })).toBeTruthy();
    expect(screen.getByText(ANSWERS_LINE)).toBeTruthy();
    const priorities = await screen.findByRole("region", {
      name: GOAL_SUMMARY.prioritiesSectionName,
    });
    expect(within(priorities).getByText(FIRST_ROW)).toBeTruthy();
    expect(within(priorities).getByText(KEPT_UP_ROW)).toBeTruthy();
    expect(within(priorities).getByText("Obliques get no direct work")).toBeTruthy();
    expect(within(priorities).getByText(FIT_ROW)).toBeTruthy();
    expect(screen.getByText(LEGEND)).toBeTruthy();
    expect(await saveButton()).toBeTruthy();
  });

  it("should count a muscle the routine trains as kept up and not as left out", async () => {
    summaryBackend.routineMuscles = MUSCLE_IDS;
    renderGoalSummary();

    await screen.findByText(KEPT_UP_ROW);

    expect(screen.queryByText(/get no direct work/)).toBeNull();
  });

  it("should leave out every muscle the goal and the routine both skip when there is no routine", async () => {
    renderGoalSummary();

    expect(await screen.findByText(NO_ROUTINE_NOT_TARGETED_ROW)).toBeTruthy();
  });

  it("should fill the two figures on the volume scale: productive, maintaining and not trained", async () => {
    renderGoalSummary();

    const front = await frontFigure();

    expect(fillClassOf(front, "front", "delt_side")).toContain("fill-volume-productive");
    expect(fillClassOf(front, "front", "chest_lower")).toContain("fill-volume-maintaining");
    expect(fillClassOf(front, "front", "obliques")).toContain("fill-volume-not-trained");
    expect(await screen.findByRole("img", { name: GOAL_SUMMARY.bodyMapBackName })).toBeTruthy();
  });

  it("should draw each figure 70 px wide", async () => {
    renderGoalSummary();

    const front = await frontFigure();
    const back = await screen.findByRole("img", { name: GOAL_SUMMARY.bodyMapBackName });

    expect(front.getAttribute("width")).toBe("70");
    expect(back.getAttribute("width")).toBe("70");
  });

  it("should draw the female figure with the same fills when that is the setting", async () => {
    window.localStorage.setItem("bodyMap.figure", "female");
    renderGoalSummary();

    const front = await frontFigure();

    expect(fillClassOf(front, "front", "delt_side", "female")).toContain("fill-volume-productive");
    expect(fillClassOf(front, "front", "chest_lower", "female")).toContain(
      "fill-volume-maintaining",
    );
  });
});

describe("the priority rows", () => {
  it("should draw each group's swatch in the colour its muscles have on the figure", async () => {
    summaryBackend.routineMuscles = MUSCLE_IDS.filter((muscle) => muscle !== "obliques");
    renderGoalSummary();
    const front = await frontFigure();
    await screen.findByText(FIRST_ROW);
    const figureToken = (muscle: MuscleId) =>
      fillClassOf(front, "front", muscle).match(/fill-(\S+)/)?.[1];

    expect(swatchClassOf(FIRST_ROW)).toContain(`bg-${figureToken("delt_side")}`);
    expect(swatchClassOf(KEPT_UP_ROW)).toContain(`bg-${figureToken("chest_lower")}`);
    expect(swatchClassOf("Obliques get no direct work")).toContain(`bg-${figureToken("obliques")}`);
    expect(figureToken("delt_side")).toBe("volume-productive");
    expect(figureToken("chest_lower")).toBe("volume-maintaining");
    expect(figureToken("obliques")).toBe("volume-not-trained");
    expect(swatchClassOf(FIT_ROW)).toContain("bg-text-muted");
  });
});

describe("the heading", () => {
  it("should take focus when the summary opens", async () => {
    renderGoalSummary();

    const heading = await screen.findByRole("heading", { level: 1, name: GOAL_SUMMARY.title });

    expect(document.activeElement).toBe(heading);
  });
});

describe("Save goal when nothing has changed", () => {
  it("should not be drawn for a goal that is opened and left as it is, and Back stays", async () => {
    renderGoalSummary(goldenAnswers, { isChanged: false });

    expect(await screen.findByRole("heading", { level: 1, name: GOAL_SUMMARY.title })).toBeTruthy();
    expect(await screen.findByText(FIRST_ROW)).toBeTruthy();
    expect(screen.queryByRole("button", { name: GOAL_SUMMARY.saveAction })).toBeNull();
    expect(screen.getByRole("button", { name: GOAL_SUMMARY.backLabel })).toBeTruthy();
    expect(summaryBackend.saved).toHaveLength(0);
  });

  it("should not show the offline line when there is no Save to explain", async () => {
    onlineManager.setOnline(false);
    renderGoalSummary(goldenAnswers, { isChanged: false });

    await screen.findByText(FIRST_ROW);

    expect(screen.queryByText(GOAL_ERRORS.saveOffline)).toBeNull();
  });

  it("should be drawn once an answer has been changed", async () => {
    renderGoalSummary(goldenAnswers, { isChanged: true });

    expect(await saveButton()).toBeTruthy();
  });
});

describe("while the routine is being read", () => {
  beforeEach(() => {
    summaryBackend.routine = "pending";
  });

  it("should draw no rows and no figures, so no muscle shows as left out before the routine is known", async () => {
    renderGoalSummary();

    await screen.findByText(ANSWERS_LINE);

    expect(screen.queryByText(FIRST_ROW)).toBeNull();
    expect(screen.queryByText(/get no direct work/)).toBeNull();
    expect(screen.queryByText(FIT_ROW)).toBeNull();
    expect(screen.queryByRole("img", { name: GOAL_SUMMARY.bodyMapFrontName })).toBeNull();
    expect(screen.queryByRole("img", { name: GOAL_SUMMARY.bodyMapBackName })).toBeNull();
  });

  it("should hold the space of the rows and of the figures, so Save goal does not move when they arrive", async () => {
    renderGoalSummary();
    const priorities = await screen.findByRole("region", {
      name: GOAL_SUMMARY.prioritiesSectionName,
    });

    expect(priorities.getAttribute("aria-busy")).toBe("true");
    expect(within(priorities).getByRole("status", { name: "Loading" }).className).toContain(
      "min-h-[290px] flex-col gap-3 min-[440px]:min-h-[240px] min-[460px]:min-h-[204px]",
    );
    expect(document.querySelectorAll(".h-\\[154px\\].w-\\[70px\\]")).toHaveLength(2);

    summaryBackend.routineMuscles = MUSCLE_IDS;
    releaseRoutineReads();

    await screen.findByText(FIRST_ROW);
    expect(priorities.getAttribute("aria-busy")).toBeNull();
    expect(within(priorities).queryByRole("status")).toBeNull();
  });

  it("should keep the answers line, the legend and Save goal live", async () => {
    renderGoalSummary();

    expect(await screen.findByText(ANSWERS_LINE)).toBeTruthy();
    expect(screen.getByText(LEGEND)).toBeTruthy();
    expect((await saveButton()).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("region", { name: GOAL_SUMMARY.prioritiesSectionName })).toBeTruthy();
  });

  it("should save the answers without waiting for the routine", async () => {
    renderGoalSummary();

    await userEvent.click(await saveButton());

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledTimes(1);
    });
    expect(summaryBackend.saved).toHaveLength(1);
  });

  it("should draw the rows and figures with the routine's kept-up result once it arrives", async () => {
    renderGoalSummary();
    await screen.findByText(ANSWERS_LINE);
    expect(screen.queryByText(FIRST_ROW)).toBeNull();

    summaryBackend.routineMuscles = MUSCLE_IDS;
    releaseRoutineReads();

    expect(await screen.findByText(FIRST_ROW)).toBeTruthy();
    expect(screen.getByText(KEPT_UP_ROW)).toBeTruthy();
    expect(screen.queryByText(/get no direct work/)).toBeNull();
    expect(await frontFigure()).toBeTruthy();
  });
});

describe("when the routine cannot be read", () => {
  it("should draw the result for no routine when the read fails", async () => {
    summaryBackend.routine = "error";
    renderGoalSummary();

    expect(await screen.findByText(NO_ROUTINE_NOT_TARGETED_ROW)).toBeTruthy();
    expect(await frontFigure()).toBeTruthy();
  });

  it("should draw the result for no routine, not wait for ever, when offline with nothing cached", async () => {
    onlineManager.setOnline(false);
    renderGoalSummary();

    expect(await screen.findByText(NO_ROUTINE_NOT_TARGETED_ROW)).toBeTruthy();
    expect(await frontFigure()).toBeTruthy();
  });
});

describe("Save goal", () => {
  it("should store the answers once and leave for the Goal page when a goal was stored", async () => {
    renderGoalSummary();

    await userEvent.click(await saveButton());

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/goal");
    });
    expect(summaryBackend.saved).toMatchObject([
      {
        p_goals: {
          goal: "aesthetic",
          focus: ["v_taper"],
          days_per_week: 4,
          session_minutes: 60,
          experience: "intermediate",
        },
      },
    ]);
    expect(summaryBackend.saved).toHaveLength(1);
  });

  it("should leave for More when it is the first goal", async () => {
    renderGoalSummary(goldenAnswers, { hasStoredGoal: false });

    await userEvent.click(await saveButton());

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/more");
    });
    expect(summaryBackend.saved).toHaveLength(1);
  });

  it("should send the answers once when it is pressed twice in the same moment", async () => {
    renderGoalSummary();
    const button = await saveButton();

    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledTimes(1);
    });
    expect(summaryBackend.saved).toHaveLength(1);
  });

  it("should show busy while the save is on its way, and not leave", async () => {
    summaryBackend.save = "pending";
    renderGoalSummary();

    await userEvent.click(await saveButton());

    expect(await screen.findByRole("button", { busy: true })).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("should stay on the summary and show the error toast when the save fails, then save again", async () => {
    summaryBackend.save = "error";
    renderGoalSummary();

    await userEvent.click(await saveButton());

    const toastHost = await screen.findByRole("status");
    expect(await within(toastHost).findByText(GOAL_ERRORS.save)).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 1, name: GOAL_SUMMARY.title })).toBeTruthy();
    expect(screen.getByText(ANSWERS_LINE)).toBeTruthy();

    summaryBackend.save = "ready";
    await userEvent.click(await saveButton());
    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/goal");
    });
    expect(summaryBackend.saved).toHaveLength(2);
  });

  it("should be off with the offline line while the browser is offline, and send nothing", async () => {
    onlineManager.setOnline(false);
    renderGoalSummary();

    const button = await saveButton();
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(await screen.findByText(GOAL_ERRORS.saveOffline)).toBeTruthy();
    await userEvent.click(button);
    expect(summaryBackend.saved).toHaveLength(0);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("should come back on, without the offline line, when the browser is online again", async () => {
    onlineManager.setOnline(false);
    renderGoalSummary();
    await screen.findByText(GOAL_ERRORS.saveOffline);

    act(() => {
      onlineManager.setOnline(true);
    });

    await waitFor(() => {
      expect(screen.queryByText(GOAL_ERRORS.saveOffline)).toBeNull();
    });
    expect((await saveButton()).hasAttribute("disabled")).toBe(false);
  });
});

describe("Back", () => {
  it("should return to the questions", async () => {
    renderGoalSummary();

    await userEvent.click(await screen.findByRole("button", { name: GOAL_SUMMARY.backLabel }));

    expect(router.back).toHaveBeenCalledTimes(1);
  });
});

describe("a draft that is not complete", () => {
  it("should send the person to the first open question and draw and save nothing", async () => {
    renderGoalSummary({ goal: "aesthetic", focus: [], days_per_week: 4 });

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/goal/4");
    });
    expect(screen.queryByRole("heading", { name: GOAL_SUMMARY.title })).toBeNull();
    expect(screen.queryByRole("button", { name: GOAL_SUMMARY.saveAction })).toBeNull();
    expect(summaryBackend.saved).toHaveLength(0);
  });

  it("should send an empty draft to the first question", async () => {
    renderGoalSummary({});

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/goal/1");
    });
  });
});
