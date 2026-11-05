import { RESTING_HEAT } from "@keylow/api-client";
import {
  BODY_MAP,
  describeNothingLogged,
  describeSavedMoment,
  TRAIN_HOME,
} from "@keylow/core/copy";
import { BODY_ARTWORK, TRAINING_PARAMS_V2, muscleState } from "@keylow/core/training";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { goldenThursdayBodyMap } from "../dashboard/bodyMapFixtures";
import { renderWithRouter } from "../ui/appRouter";

import type { BodyMap, TrainingReadResult } from "@keylow/api-client";
import type { MuscleId, MuscleState } from "@keylow/core/training";

import { TrainBodyMap } from "@/components/train/TrainBodyMap";
import { resetBodyFigureForTests } from "@/lib/bodyFigure/testing";

const reads = vi.hoisted(
  (): {
    byView: Record<string, unknown>;
    asked: { view: string; scale: string; weekStart: string; now: string }[];
    states: unknown;
  } => ({ byView: {}, asked: [], states: undefined }),
);

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useBodyMap: (input: { view: string; scale: string; weekStart: string; now: string }) => {
    reads.asked.push({
      view: input.view,
      scale: input.scale,
      weekStart: input.weekStart,
      now: input.now,
    });
    return reads.byView[input.view];
  },
  useMuscleState: () => reads.states,
}));

const refetch = () => Promise.resolve();
const loaded = <T,>(data: T): TrainingReadResult<T> => ({
  data,
  isPending: false,
  isError: false,
  error: null,
  refetch,
});
const pending: TrainingReadResult<never> = {
  data: undefined,
  isPending: true,
  isError: false,
  error: null,
  refetch,
};
const failed: TrainingReadResult<never> = {
  data: undefined,
  isPending: false,
  isError: true,
  error: new Error("read failed"),
  refetch,
};

// Thursday 15 October 2026 at 17:55 in London, the agreed golden week.
const THURSDAY_17_55 = "2026-10-15T16:55:00.000Z";
const TIME_ZONE = "Europe/London";

const goldenActual: BodyMap = {
  values: goldenThursdayBodyMap.values,
  computedAt: THURSDAY_17_55,
  days: [],
  todayProjectedIsActual: true,
  projectedAvailable: true,
  nothingLogged: false,
};
const goldenProjected: BodyMap = {
  ...goldenActual,
  values: { ...goldenActual.values, lats: 5, biceps: 4 },
};

const stateAt = (heat: number): MuscleState => ({
  heat,
  readyAt: THURSDAY_17_55,
  weeklySets: 0,
  volumeStatus: "not_trained",
});
// Every muscle at rest, which core works out from no sets.
const restingStates = muscleState([], THURSDAY_17_55, TRAINING_PARAMS_V2);
const goldenStates: Record<MuscleId, MuscleState> = {
  ...restingStates,
  lats: stateAt(0.25),
  traps_mid: stateAt(0.18),
  biceps: stateAt(0.15),
};

function show(actual: unknown, projected: unknown = actual) {
  reads.byView = { actual, projected };
}

const FRONT_NAME = "Body map, Actual, heat, front. Open the body map for each muscle.";
const BACK_NAME = "Body map, Actual, heat, back";

const card = () => screen.getByRole("region", { name: BODY_MAP.title });
const toggle = () => screen.getByRole("button", { name: /^Show (projected|actual)$/ });
const fillOf = (name: string, path: string) =>
  screen.getByRole("img", { name }).querySelector(`path[d="${path}"]`)?.getAttribute("class") ?? "";

function renderCard(savedAt = new Date(THURSDAY_17_55)) {
  return renderWithRouter(<TrainBodyMap timeZone={TIME_ZONE} savedAt={savedAt} />);
}

describe("TrainBodyMap", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(THURSDAY_17_55));
    window.localStorage.clear();
    window.localStorage.setItem("bodyMap.figure", "male");
    resetBodyFigureForTests();
    onlineManager.setOnline(true);
    reads.asked = [];
    reads.states = loaded(goldenStates);
    show(loaded(goldenActual), loaded(goldenProjected));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    act(() => {
      onlineManager.setOnline(true);
    });
  });

  describe("on Thursday at 17:55", () => {
    it("should name the view Actual and say it is now, as the board draws it", () => {
      renderCard();

      const label = within(card()).getByRole("status");
      expect(within(label).getByText("Actual")).toBeTruthy();
      expect(within(label).getByText("Now · Thu 15 Oct, 17:55")).toBeTruthy();
    });

    it("should fill the muscles at the steps of the board, front and back", () => {
      renderCard();

      const { front, back } = BODY_ARTWORK.male;
      expect(fillOf(FRONT_NAME, front.muscles.chest_upper)).toContain("fill-heat-1");
      expect(fillOf(FRONT_NAME, front.muscles.biceps)).toContain("fill-heat-1");
      expect(fillOf(FRONT_NAME, front.muscles.quads)).toContain("fill-heat-0");
      expect(fillOf(BACK_NAME, back.muscles.lats)).toContain("fill-heat-2");
      expect(fillOf(BACK_NAME, back.muscles.triceps)).toContain("fill-heat-1");
    });

    it("should draw the heat legend beside the figures", () => {
      renderCard();

      expect(within(card()).getByRole("img", { name: BODY_MAP.legendNames.heat })).toBeTruthy();
    });

    it("should name the muscles that are warmest, from their heat now", () => {
      renderCard();

      expect(
        within(card()).getByText("Warmest: lats 25 %, mid traps 18 %, biceps 15 %"),
      ).toBeTruthy();
    });

    it("should read the heat of both views for the week, at the time on the clock", () => {
      renderCard();

      expect(new Set(reads.asked.map(({ view }) => view))).toStrictEqual(
        new Set(["actual", "projected"]),
      );
      expect(new Set(reads.asked.map(({ scale }) => scale))).toStrictEqual(new Set(["heat"]));
      expect(new Set(reads.asked.map(({ weekStart }) => weekStart))).toStrictEqual(
        new Set(["2026-10-12"]),
      );
      expect(new Set(reads.asked.map(({ now }) => now))).toStrictEqual(new Set([THURSDAY_17_55]));
    });

    it("should draw the figures as plain images with no muscle to press", () => {
      renderCard();

      expect(screen.getByRole("img", { name: FRONT_NAME })).toBeTruthy();
      expect(screen.getByRole("img", { name: BACK_NAME })).toBeTruthy();
      expect(
        within(card())
          .getAllByRole("button")
          .map((button) => button.textContent),
      ).toEqual(["Show projected"]);
    });
  });

  describe("Show projected", () => {
    it("should switch to the projected heat and name the button for the way back", async () => {
      renderCard();

      await userEvent.click(toggle());

      expect(within(within(card()).getByRole("status")).getByText("Projected")).toBeTruthy();
      expect(toggle().textContent).toBe("Show actual");
      const back = screen.getByRole("img", { name: "Body map, Projected, heat, back" });
      expect(
        back
          .querySelector(`path[d="${BODY_ARTWORK.male.back.muscles.lats}"]`)
          ?.getAttribute("class"),
      ).toContain("fill-heat-5");
    });

    it("should switch back to the actual heat", async () => {
      renderCard();

      await userEvent.click(toggle());
      await userEvent.click(toggle());

      expect(within(within(card()).getByRole("status")).getByText("Actual")).toBeTruthy();
      expect(fillOf(BACK_NAME, BODY_ARTWORK.male.back.muscles.lats)).toContain("fill-heat-2");
    });

    it("should leave the warmest line to Actual, since it is the heat now", async () => {
      renderCard();

      await userEvent.click(toggle());

      expect(within(card()).queryByText(/^Warmest:/)).toBeNull();
    });

    it("should be off, with the line that says why, when there is no routine", async () => {
      show(loaded(goldenActual), loaded({ ...goldenProjected, projectedAvailable: false }));
      renderCard();

      const button = toggle();
      expect(button).toHaveProperty("disabled", true);
      expect(within(card()).getByText(BODY_MAP.toggle.projectedNeedsRoutine)).toBeTruthy();
      await userEvent.click(button);
      expect(toggle().textContent).toBe("Show projected");
    });
  });

  describe("Open body map", () => {
    it("should be a link to the body map", async () => {
      const { push } = renderCard();

      const link = within(card()).getByRole("link", { name: BODY_MAP.trainCard.openName });
      expect(link.getAttribute("href")).toBe("/body-map");
      await userEvent.click(link);
      expect(push).toHaveBeenCalledWith("/body-map", { scroll: true });
    });
  });

  describe("the figure setting", () => {
    it("should draw the female figure when the setting says so", () => {
      window.localStorage.setItem("bodyMap.figure", "female");
      resetBodyFigureForTests();
      renderCard();

      expect(fillOf(BACK_NAME, BODY_ARTWORK.female.back.muscles.lats)).toContain("fill-heat-2");
      expect(
        screen
          .getByRole("img", { name: BACK_NAME })
          .querySelector(`path[d="${BODY_ARTWORK.male.back.muscles.lats}"]`),
      ).toBeNull();
    });

    it("should not draw a figure on the server, where the setting is not known", () => {
      show(loaded(goldenActual));
      const html = renderToString(<TrainBodyMap timeZone={TIME_ZONE} savedAt={new Date()} />);

      expect(html).not.toContain(FRONT_NAME);
    });
  });

  describe("with nothing logged in 14 days", () => {
    it("should say so under the view, and warm no muscle", () => {
      reads.states = loaded(restingStates);
      show(
        loaded({ ...goldenActual, values: RESTING_HEAT, nothingLogged: true }),
        loaded({ ...goldenProjected, values: RESTING_HEAT }),
      );
      renderCard();

      expect(
        within(card()).getByText(describeNothingLogged(TRAINING_PARAMS_V2.heatWindowDays)),
      ).toBeTruthy();
      expect(within(card()).queryByText(/^Warmest:/)).toBeNull();
    });
  });

  describe("offline", () => {
    it("should show the heat the page saved, at the moment it was saved", () => {
      const savedAt = new Date("2026-10-15T16:52:00.000Z");
      onlineManager.setOnline(false);
      renderCard(savedAt);

      expect(
        within(card()).getByText(describeSavedMoment(savedAt.toISOString(), TIME_ZONE)),
      ).toBeTruthy();
      expect(new Set(reads.asked.map(({ now }) => now))).toStrictEqual(
        new Set([savedAt.toISOString()]),
      );
    });

    it("should say the body map is not available when nothing was saved, and not load for ever", () => {
      onlineManager.setOnline(false);
      show(pending);
      renderCard();

      expect(screen.getByText(BODY_MAP.dashboardCard.offlineUnavailable)).toBeTruthy();
      expect(
        screen.queryByRole("status", { name: BODY_MAP.dashboardCard.loadingLabel }),
      ).toBeNull();
    });
  });

  describe("while it reads, and when a read fails", () => {
    it("should show the loading skeleton while a view is on its way", () => {
      show(loaded(goldenActual), pending);
      renderCard();

      expect(
        screen.getByRole("status", { name: BODY_MAP.dashboardCard.loadingLabel }),
      ).toBeTruthy();
    });

    it("should say a read failed, with no button to press", () => {
      show(failed);
      renderCard();

      expect(screen.getByText(BODY_MAP.dashboardCard.loadFailed)).toBeTruthy();
      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.queryByRole("link", { name: TRAIN_HOME.title })).toBeNull();
    });
  });
});
