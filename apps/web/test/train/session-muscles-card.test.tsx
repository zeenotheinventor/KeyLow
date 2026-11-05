import { FINISH_SCREEN, SESSION_ACTIVE } from "@keylow/core/copy";
import { BODY_ARTWORK } from "@keylow/core/training";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PULL_SESSION_ID,
  detailBackend,
  goldenPullSession,
  renderWithDetail,
  resetDetailBackend,
} from "./sessionDetailBackend";
import {
  LEGS_DAY_ID,
  freshLegsOpen,
  goldenLegsOpen,
  legsRoutine,
  previousThursday,
} from "./sessionGolden";
import { renderWithTrain, resetTrainBackend, trainBackend } from "./support";

import { SessionScreen } from "@/components/train";
import { SessionDetailScreen } from "@/components/train/SessionDetailScreen";
import { ToastProvider } from "@/components/ui/Toast";
import { resetBodyFigureForTests } from "@/lib/bodyFigure/testing";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

// A switch the tests turn, to stand for the first draw in the browser, before the stored figure is read.
const figureStore = vi.hoisted(() => ({ isReady: true }));
vi.mock("@/lib/bodyFigure", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bodyFigure")>();
  return {
    ...actual,
    useBodyFigure: () => ({ ...actual.useBodyFigure(), isReady: figureStore.isReady }),
  };
});

// 19:00 in London on Thursday 15 October, the end of the golden Legs session.
const THURSDAY_1900 = new Date("2026-10-15T18:00:00Z");

const SIDE_CARD = SESSION_ACTIVE.sideCardHeading;
const FRONT = "This session's heat, front";
const BACK = "This session's heat, back";

const goldenLegsRows = [
  "Hamstrings, 5.5 sets, Hot",
  "Quads, 5 sets, Hot",
  "Glutes, 4 sets, Hot",
  "Lower back, 2.1 sets, Ready",
  "Calves, 1.6 sets, Ready",
];

const rowsOf = (region: HTMLElement) =>
  within(region)
    .getAllByRole("listitem")
    .map((row) => row.getAttribute("aria-label"));

const fillOf = (region: HTMLElement, figure: string, path: string) =>
  within(region)
    .getByRole("img", { name: figure })
    .querySelector(`path[d="${path}"]`)
    ?.getAttribute("class") ?? "";

const renderSession = () =>
  renderWithTrain(
    <ToastProvider>
      <SessionScreen />
    </ToastProvider>,
  );

const openGoldenLegs = () => {
  trainBackend.routine = legsRoutine;
  // Each exercise snapshotted with the muscles it really works, as the golden week has them.
  trainBackend.activeSession = goldenLegsOpen(LEGS_DAY_ID, [], "legs");
  trainBackend.lastPerformance = previousThursday;
};

describe("the muscles cards", () => {
  beforeEach(() => {
    resetTrainBackend();
    resetDetailBackend();
    resetBodyFigureForTests();
    window.localStorage.clear();
    figureStore.isReady = true;
    router.push.mockReset();
    router.replace.mockReset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(THURSDAY_1900);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    act(() => {
      onlineManager.setOnline(true);
    });
  });

  describe("This session so far, beside the exercises of the session page", () => {
    it("should list the golden Legs muscles with their effective sets, most first", async () => {
      openGoldenLegs();
      renderSession();

      const side = await screen.findByRole("region", { name: SIDE_CARD });
      expect(within(side).getByRole("heading", { level: 2, name: SIDE_CARD })).toBeTruthy();
      expect(within(side).getByRole("list")).toBeTruthy();
      expect(rowsOf(side)).toEqual(goldenLegsRows);
    });

    it("should fill the front and the back figures with this session's heat", async () => {
      openGoldenLegs();
      renderSession();

      const side = await screen.findByRole("region", { name: SIDE_CARD });
      expect(fillOf(side, FRONT, BODY_ARTWORK.male.front.muscles.quads)).toContain("fill-heat-3");
      expect(fillOf(side, BACK, BODY_ARTWORK.male.back.muscles.hamstrings)).toContain(
        "fill-heat-3",
      );
      expect(fillOf(side, BACK, BODY_ARTWORK.male.back.muscles.calves)).toContain("fill-heat-1");
      expect(fillOf(side, FRONT, BODY_ARTWORK.male.front.muscles.chest_upper)).toContain(
        "fill-heat-0",
      );
    });

    it("should update the figures and the list at once when another set is logged, between two ticks of the clock", async () => {
      openGoldenLegs();
      renderSession();
      const side = await screen.findByRole("region", { name: SIDE_CARD });
      expect(rowsOf(side)).toContain("Quads, 5 sets, Hot");
      expect(fillOf(side, FRONT, BODY_ARTWORK.male.front.muscles.quads)).toContain("fill-heat-3");

      // The page's clock ticks once a minute, so a set logged half a minute after it was read is stamped later than it.
      act(() => {
        vi.setSystemTime(new Date(THURSDAY_1900.getTime() + 30_000));
      });
      const legPress = await screen.findByRole("region", { name: "Leg press" });
      await userEvent.click(
        within(legPress).getByRole("button", { name: "Log set 3, 180 kilograms, 11 reps" }),
      );

      expect(
        await within(side).findByRole("listitem", { name: "Quads, 6 sets, Very hot" }),
      ).toBeTruthy();
      expect(rowsOf(side)).not.toContain("Quads, 5 sets, Hot");
      expect(fillOf(side, FRONT, BODY_ARTWORK.male.front.muscles.quads)).toContain("fill-heat-4");
    });

    it("should be left out while no working set is logged", async () => {
      trainBackend.routine = legsRoutine;
      trainBackend.activeSession = freshLegsOpen("2026-10-15T17:48:00Z");
      renderSession();

      expect(await screen.findByRole("region", { name: "Barbell squat" })).toBeTruthy();
      expect(screen.queryByRole("region", { name: SIDE_CARD })).toBeNull();
    });

    it("should hold the one Add exercise button of the page, in the card and out of it", async () => {
      openGoldenLegs();
      renderSession();
      const side = await screen.findByRole("region", { name: SIDE_CARD });
      expect(
        screen.getAllByRole("button", { name: SESSION_ACTIVE.addExerciseAction }),
      ).toHaveLength(1);
      expect(
        within(side).getByRole("button", { name: SESSION_ACTIVE.addExerciseAction }),
      ).toBeTruthy();

      cleanup();
      trainBackend.activeSession = freshLegsOpen("2026-10-15T17:48:00Z");
      renderSession();
      await screen.findByRole("region", { name: "Barbell squat" });

      expect(
        screen.getAllByRole("button", { name: SESSION_ACTIVE.addExerciseAction }),
      ).toHaveLength(1);
    });

    it("should draw the female figure when that is the figure chosen", async () => {
      window.localStorage.setItem("bodyMap.figure", "female");
      openGoldenLegs();
      renderSession();

      const side = await screen.findByRole("region", { name: SIDE_CARD });
      expect(
        within(side)
          .getByRole("img", { name: FRONT })
          .querySelector(`path[d="${BODY_ARTWORK.female.front.outline}"]`),
      ).not.toBeNull();
    });

    it("should wait for the stored figure before it draws any", async () => {
      figureStore.isReady = false;
      openGoldenLegs();
      renderSession();

      expect(await screen.findByRole("region", { name: "Barbell squat" })).toBeTruthy();
      expect(screen.queryByRole("region", { name: SIDE_CARD })).toBeNull();
      expect(screen.queryByRole("img", { name: FRONT })).toBeNull();
    });

    it("should stay on screen when the connection is lost, as it reads nothing", async () => {
      openGoldenLegs();
      renderSession();
      await screen.findByRole("region", { name: SIDE_CARD });

      act(() => {
        onlineManager.setOnline(false);
      });

      expect(rowsOf(screen.getByRole("region", { name: SIDE_CARD }))).toEqual(goldenLegsRows);
    });

    it("should not announce each change to a screen reader", async () => {
      openGoldenLegs();
      renderSession();

      const side = await screen.findByRole("region", { name: SIDE_CARD });
      expect(side.closest("[aria-live]")).toBeNull();
      expect(side.querySelector("[aria-live]")).toBeNull();
      expect(within(side).queryByRole("status")).toBeNull();
    });
  });

  describe("Muscles trained, in the finish dialog", () => {
    it("should show this session's muscles, with the caption and a figure for each side", async () => {
      openGoldenLegs();
      renderSession();
      await userEvent.click(
        await screen.findByRole("button", { name: SESSION_ACTIVE.finishAction }),
      );

      const dialog = await screen.findByRole("dialog", { name: "Finish Legs" });
      const card = within(dialog).getByRole("region", { name: FINISH_SCREEN.musclesHeading });
      expect(
        within(card).getByRole("heading", { name: FINISH_SCREEN.musclesHeading }),
      ).toBeTruthy();
      expect(within(card).getByText(FINISH_SCREEN.effectiveSetsCaption)).toBeTruthy();
      expect(rowsOf(card)).toEqual(goldenLegsRows);
      expect(fillOf(card, FRONT, BODY_ARTWORK.male.front.muscles.quads)).toContain("fill-heat-3");
      expect(fillOf(card, BACK, BODY_ARTWORK.male.back.muscles.calves)).toContain("fill-heat-1");
    });
  });

  describe("Muscles trained, on the session detail", () => {
    it("should show the muscles of the golden Pull, most first, under the three cards", async () => {
      detailBackend.sessions = [goldenPullSession()];
      renderWithDetail(<SessionDetailScreen id={PULL_SESSION_ID} origin="history" />);

      const card = await screen.findByRole("region", { name: FINISH_SCREEN.musclesHeading });
      expect(within(card).getByText(FINISH_SCREEN.effectiveSetsCaption)).toBeTruthy();
      expect(rowsOf(card)).toEqual(["Lats, 16 sets, Peak", "Biceps, 9.6 sets, Peak"]);
      expect(within(card).getByRole("img", { name: FRONT })).toBeTruthy();
      expect(within(card).getByRole("img", { name: BACK })).toBeTruthy();
    });

    it("should stay on screen when the connection is lost after the session is read", async () => {
      detailBackend.sessions = [goldenPullSession()];
      renderWithDetail(<SessionDetailScreen id={PULL_SESSION_ID} origin="history" />);
      await screen.findByRole("region", { name: FINISH_SCREEN.musclesHeading });

      act(() => {
        onlineManager.setOnline(false);
      });

      expect(screen.getByRole("region", { name: FINISH_SCREEN.musclesHeading })).toBeTruthy();
    });
  });
});
