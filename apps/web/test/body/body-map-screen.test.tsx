import { RESTING_HEAT } from "@keylow/api-client";
import { BODY_MAP, TRAIN_ERROR, TRAIN_OFFLINE_TITLE, TRAIN_START_FAILED } from "@keylow/core/copy";
import { BODY_ARTWORK } from "@keylow/core/training";
import { onlineManager } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render as renderIn,
  screen,
  within,
} from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BodyMap, TrainingReadResult } from "@keylow/api-client";
import type { BodyMapView } from "@keylow/core/training";
import type { ReactElement } from "react";

import { BodyMapScreen } from "@/components/body/BodyMapScreen";
import { ToastProvider } from "@/components/ui/Toast";

type BodyMapRead = TrainingReadResult<BodyMap>;

const router = vi.hoisted(() => ({
  back: vi.fn<() => void>(),
  push: vi.fn<(href: string) => void>(),
}));
const sessionStart = vi.hoisted(() => ({
  start: vi.fn<(request: { routineDayId: string | null; timeZone: string }) => void>(),
  notices: { onStarted: (): void => undefined, onFailure: (): void => undefined },
}));
const reads = vi.hoisted(
  (): {
    byView: Record<string, unknown>;
    asked: { view: string; scale: string }[];
    zone: unknown;
  } => ({
    byView: {},
    asked: [],
    zone: undefined,
  }),
);

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useProfileTimeZone: () => reads.zone,
  useStartSessionAction: (notices: typeof sessionStart.notices) => {
    sessionStart.notices = notices;
    return { start: sessionStart.start, isStarting: false };
  },
  useBodyMap: ({ view, scale }: { view: string; scale: string }) => {
    reads.asked.push({ view, scale });
    return reads.byView[view];
  },
}));

// The dashboard layout holds the toast provider the screen's failure toast needs.
const render = (ui: ReactElement) => renderIn(ui, { wrapper: ToastProvider });

const refetch = vi.fn<() => Promise<unknown>>(() => Promise.resolve());
const read = (data: BodyMap): BodyMapRead => ({
  data,
  isPending: false,
  isError: false,
  error: null,
  refetch,
});
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

// Thursday 15 October 2026 at 19:00 in London, the agreed golden week.
const THURSDAY_19_00 = "2026-10-15T18:00:00.000Z";
const goldenActual: BodyMap = {
  values: {
    ...RESTING_HEAT,
    chest_upper: 1,
    chest_lower: 1,
    delt_rear: 1,
    lats: 2,
    traps_mid: 1,
    lower_back: 2,
    biceps: 1,
    triceps: 1,
    glute_max: 3,
    quads: 3,
    hamstrings: 3,
    calves: 2,
  },
  computedAt: THURSDAY_19_00,
  days: [],
  todayProjectedIsActual: true,
  projectedAvailable: true,
  nothingLogged: false,
};
const goldenProjected: BodyMap = {
  ...goldenActual,
  values: { ...goldenActual.values, lats: 5, quads: 4 },
};

function show(actual: BodyMapRead, projected: BodyMapRead = actual) {
  reads.byView = { actual, projected };
}

const figure = (side: "front" | "back", view = "Actual") =>
  screen.getByRole("img", { name: `Body map, ${view}, heat, ${side}` });
const fillOf = (side: "front" | "back", path: string, view = "Actual") =>
  figure(side, view).querySelector(`path[d="${path}"]`)?.getAttribute("class") ?? "";
const toggle = () => screen.getByRole("button", { name: /^Show (projected|actual)$/ });
const viewLabel = () =>
  within(screen.getByRole("region", { name: BODY_MAP.title })).getByRole("status");

describe("BodyMapScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"],
    });
    vi.setSystemTime(new Date(THURSDAY_19_00));
    window.localStorage.clear();
    onlineManager.setOnline(true);
    reads.asked = [];
    reads.zone = { data: "Europe/London" };
    show(read(goldenActual), read(goldenProjected));
  });

  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(window, "navigation");
    vi.useRealTimers();
    vi.restoreAllMocks();
    router.back.mockReset();
    router.push.mockReset();
    sessionStart.start.mockReset();
    refetch.mockClear();
    onlineManager.setOnline(true);
  });

  describe("the page", () => {
    it("should title itself Body map at level one", () => {
      render(<BodyMapScreen />);

      expect(screen.getByRole("heading", { level: 1, name: BODY_MAP.title })).toBeTruthy();
    });

    it("should read Actual and Projected heat, and nothing else", () => {
      render(<BodyMapScreen />);

      expect(new Set(reads.asked.map(({ scale }) => scale))).toStrictEqual(new Set(["heat"]));
      expect(new Set(reads.asked.map(({ view }) => view))).toStrictEqual(
        new Set(["actual", "projected"]),
      );
    });
  });

  describe("Actual heat on Thursday at 19:00", () => {
    it("should label the view Actual, and say it is now, in a live region", () => {
      render(<BodyMapScreen />);

      expect(within(viewLabel()).getByText("Actual")).toBeTruthy();
      expect(within(viewLabel()).getByText("Now · Thu 15 Oct, 19:00")).toBeTruthy();
    });

    it("should fill the muscles at the steps of the board, front and back", () => {
      render(<BodyMapScreen />);

      const { front, back } = BODY_ARTWORK.male;
      expect(fillOf("front", front.muscles.chest_upper)).toContain("fill-heat-1");
      expect(fillOf("front", front.muscles.quads)).toContain("fill-heat-3");
      expect(fillOf("front", front.muscles.biceps)).toContain("fill-heat-1");
      expect(fillOf("front", front.muscles.delt_front)).toContain("fill-heat-0");
      expect(fillOf("back", back.muscles.lats)).toContain("fill-heat-2");
      expect(fillOf("back", back.muscles.hamstrings)).toContain("fill-heat-3");
      expect(fillOf("back", back.muscles.calves)).toContain("fill-heat-2");
      expect(fillOf("back", back.muscles.lower_back)).toContain("fill-heat-2");
    });

    it("should name each figure and put Front and Back under them", () => {
      render(<BodyMapScreen />);

      expect(figure("front")).toBeTruthy();
      expect(figure("back")).toBeTruthy();
      expect(screen.getByText(BODY_MAP.sideSwitch.front)).toBeTruthy();
      // The Back link and the name under the back figure.
      expect(screen.getAllByText(BODY_MAP.sideSwitch.back)).toHaveLength(2);
    });

    it("should draw the figures as plain images, with no muscle buttons", () => {
      render(<BodyMapScreen />);

      expect(screen.queryAllByRole("button", { name: /, (rested|light|warm|hot)/i })).toHaveLength(
        0,
      );
    });

    it("should colour the legend swatches from the rested step up to the peak, in order", () => {
      render(<BodyMapScreen />);

      const legend = screen.getByRole("region", { name: BODY_MAP.legendNames.heat });
      // The swatches are decorative and hidden from a screen reader, so they are found by that.
      const swatches = Array.from(legend.querySelectorAll('span[aria-hidden="true"]'));
      expect(swatches).toHaveLength(6);
      swatches.forEach((swatch, step) => {
        expect(swatch.classList.contains(`bg-heat-${step}`)).toBe(true);
      });
    });

    it("should draw the heat legend with its six steps and the web caption", () => {
      render(<BodyMapScreen />);

      const legend = screen.getByRole("region", { name: BODY_MAP.legendNames.heat });
      expect(within(legend).getByRole("heading", { name: BODY_MAP.scaleSwitch.heat })).toBeTruthy();
      for (const step of ["Rested", "Ready", "Warm", "Hot", "Very hot", "Peak"]) {
        expect(within(legend).getByText(step)).toBeTruthy();
      }
      expect(
        within(legend).getByText(
          "How hard and how recently each muscle worked. It cools as you recover. Press and hold a muscle, or pick it below, for its details.",
        ),
      ).toBeTruthy();
    });
  });

  describe("the Back link", () => {
    it("should go to the dashboard when the page was opened directly", () => {
      vi.spyOn(window.history, "length", "get").mockReturnValue(1);
      render(<BodyMapScreen />);

      const back = screen.getByRole("link", { name: BODY_MAP.back });
      expect(back.getAttribute("href")).toBe("/dashboard");
      fireEvent.click(back);
      expect(router.back).not.toHaveBeenCalled();
    });

    it("should return to the previous page when there is one", () => {
      vi.spyOn(window.history, "length", "get").mockReturnValue(3);
      render(<BodyMapScreen />);

      fireEvent.click(screen.getByRole("link", { name: BODY_MAP.back }));

      expect(router.back).toHaveBeenCalledTimes(1);
    });

    it("should go to the dashboard when the browser says no page of the app came before, whatever the history holds", () => {
      vi.spyOn(window.history, "length", "get").mockReturnValue(3);
      Object.defineProperty(window, "navigation", {
        value: { canGoBack: false },
        configurable: true,
      });
      render(<BodyMapScreen />);

      fireEvent.click(screen.getByRole("link", { name: BODY_MAP.back }));

      expect(router.back).not.toHaveBeenCalled();
    });

    it("should leave a click with a modifier key to the browser, which opens the dashboard in a new tab", () => {
      vi.spyOn(window.history, "length", "get").mockReturnValue(3);
      render(<BodyMapScreen />);

      fireEvent.click(screen.getByRole("link", { name: BODY_MAP.back }), { metaKey: true });

      expect(router.back).not.toHaveBeenCalled();
    });
  });

  describe("the view toggle", () => {
    it("should be named for the view it switches to", () => {
      render(<BodyMapScreen />);

      expect(toggle().textContent).toBe(BODY_MAP.toggle.showProjected);
    });

    it("should switch to Projected on a press of the button, announce it, and offer Show actual", () => {
      render(<BodyMapScreen />);

      fireEvent.click(toggle());

      expect(within(viewLabel()).getByText("Projected")).toBeTruthy();
      expect(toggle().textContent).toBe(BODY_MAP.toggle.showActual);
      expect(fillOf("back", BODY_ARTWORK.male.back.muscles.lats, "Projected")).toContain(
        "fill-heat-5",
      );
    });

    it("should switch on a click on a figure", () => {
      render(<BodyMapScreen />);

      fireEvent.click(figure("front"));

      expect(within(viewLabel()).getByText("Projected")).toBeTruthy();
      fireEvent.click(figure("back", "Projected"));
      expect(within(viewLabel()).getByText("Actual")).toBeTruthy();
    });

    it("should not switch on a drag across a figure", () => {
      render(<BodyMapScreen />);

      const front = figure("front");
      fireEvent.mouseDown(front, { clientX: 10, clientY: 10 });
      fireEvent.mouseUp(front, { clientX: 80, clientY: 90 });
      fireEvent.click(front, { clientX: 80, clientY: 90 });

      expect(within(viewLabel()).getByText("Actual")).toBeTruthy();
    });

    it("should say why Projected is what is logged today, in the board's words", () => {
      render(<BodyMapScreen />);
      expect(screen.queryByText(BODY_MAP.notes.todayProjected)).toBeNull();

      fireEvent.click(toggle());

      expect(screen.getByText(BODY_MAP.notes.todayProjected)).toBeTruthy();
    });

    it("should remember the view across a reload", () => {
      const first = render(<BodyMapScreen />);
      fireEvent.click(toggle());
      first.unmount();

      render(<BodyMapScreen />);

      expect(within(viewLabel()).getByText("Projected")).toBeTruthy();
      expect(toggle().textContent).toBe(BODY_MAP.toggle.showActual);
    });

    it("should open on Actual when the saved view is not one, or storage is blocked", () => {
      window.localStorage.setItem("bodyMap.view", "sideways");
      render(<BodyMapScreen />);
      expect(within(viewLabel()).getByText("Actual")).toBeTruthy();
      cleanup();

      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError");
      });
      render(<BodyMapScreen />);
      expect(within(viewLabel()).getByText("Actual")).toBeTruthy();
    });

    it("should hide the figures of the view that is not shown from a screen reader", () => {
      render(<BodyMapScreen />);
      expect(screen.queryByRole("img", { name: "Body map, Projected, heat, front" })).toBeNull();
      expect(screen.queryByRole("img", { name: "Body map, Projected, heat, back" })).toBeNull();

      fireEvent.click(toggle());

      expect(screen.queryByRole("img", { name: "Body map, Actual, heat, front" })).toBeNull();
      expect(screen.queryByRole("img", { name: "Body map, Actual, heat, back" })).toBeNull();
      expect(figure("front", "Projected")).toBeTruthy();
    });

    it("should still switch the view for the visit when the choice cannot be saved", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError");
      });
      render(<BodyMapScreen />);

      fireEvent.click(toggle());

      expect(within(viewLabel()).getByText("Projected")).toBeTruthy();
      expect(toggle().textContent).toBe(BODY_MAP.toggle.showActual);
    });

    it("should draw the loading skeleton on the server, whatever view is saved", () => {
      window.localStorage.setItem("bodyMap.view", "projected" satisfies BodyMapView);

      const page = document.createElement("div");
      page.innerHTML = renderToString(
        <ToastProvider>
          <BodyMapScreen />
        </ToastProvider>,
      );

      expect(
        within(page).getByRole("status", { name: BODY_MAP.dashboardCard.loadingLabel }),
      ).toBeTruthy();
      expect(within(page).queryByText("Actual")).toBeNull();
      expect(within(page).queryByText("Projected")).toBeNull();
      expect(within(page).queryByRole("button", { name: /^Show/ })).toBeNull();
    });

    it("should cross-fade the figures, and swap at once under reduced motion", () => {
      render(<BodyMapScreen />);

      const layer = figure("front").parentElement;
      expect(layer?.className).toContain("transition-opacity");
      expect(layer?.className).toContain("duration-standard");
      expect(layer?.className).toContain("motion-reduce:transition-none");
    });
  });

  describe("with no routine", () => {
    const noRoutine = { ...goldenActual, projectedAvailable: false };

    beforeEach(() => {
      show(read(noRoutine));
    });

    it("should disable the button and say Projected needs a routine", () => {
      render(<BodyMapScreen />);

      expect(toggle().hasAttribute("disabled")).toBe(true);
      expect(screen.getByText(BODY_MAP.toggle.projectedNeedsRoutine)).toBeTruthy();
    });

    it("should describe the disabled button by the line that says why", () => {
      render(<BodyMapScreen />);

      expect(
        screen.getByRole("button", {
          name: BODY_MAP.toggle.showProjected,
          description: BODY_MAP.toggle.projectedNeedsRoutine,
        }),
      ).toBeTruthy();
    });

    it("should still show Actual when Projected was saved", () => {
      window.localStorage.setItem("bodyMap.view", "projected" satisfies BodyMapView);
      render(<BodyMapScreen />);

      fireEvent.click(figure("front"));

      expect(within(viewLabel()).getByText("Actual")).toBeTruthy();
    });

    it("should do nothing on a click on a figure, and leave the saved view as it was", () => {
      window.localStorage.setItem("bodyMap.view", "actual" satisfies BodyMapView);
      render(<BodyMapScreen />);

      fireEvent.click(figure("front"));

      expect(within(viewLabel()).getByText("Actual")).toBeTruthy();
      expect(window.localStorage.getItem("bodyMap.view")).toBe("actual");
    });
  });

  describe("with no sets", () => {
    beforeEach(() => {
      show(read({ ...goldenActual, values: RESTING_HEAT, nothingLogged: true }));
    });

    it("should say nothing is logged in the last 14 days under the label", () => {
      render(<BodyMapScreen />);

      expect(within(viewLabel()).getByText("Nothing logged in the last 14 days")).toBeTruthy();
    });

    it("should show the empty state and leave the legend out", () => {
      render(<BodyMapScreen />);

      expect(
        screen.getByRole("heading", { level: 2, name: BODY_MAP.emptyState.title }),
      ).toBeTruthy();
      expect(screen.getByText(BODY_MAP.emptyState.body)).toBeTruthy();
      expect(screen.queryByRole("region", { name: BODY_MAP.legendNames.heat })).toBeNull();
    });

    it("should offer no Start a session while there is something to show", () => {
      show(read(goldenActual));
      render(<BodyMapScreen />);

      expect(screen.queryByRole("button", { name: BODY_MAP.emptyState.action })).toBeNull();
    });

    it("should offer Start a session, which starts a free session in the profile's zone", () => {
      render(<BodyMapScreen />);

      fireEvent.click(screen.getByRole("button", { name: BODY_MAP.emptyState.action }));

      expect(sessionStart.start).toHaveBeenCalledWith({
        routineDayId: null,
        timeZone: "Europe/London",
      });
    });

    it("should open the session page once it has started", () => {
      render(<BodyMapScreen />);

      act(() => {
        sessionStart.notices.onStarted();
      });

      expect(router.push).toHaveBeenCalledWith("/train/session");
    });

    it("should say at the top that the start failed, and open nothing", () => {
      render(<BodyMapScreen />);

      act(() => {
        sessionStart.notices.onFailure();
      });

      expect(screen.getByText(TRAIN_START_FAILED)).toBeTruthy();
      expect(router.push).not.toHaveBeenCalled();
    });

    it("should still draw the figures at rest", () => {
      render(<BodyMapScreen />);

      expect(fillOf("front", BODY_ARTWORK.male.front.muscles.quads)).toContain("fill-heat-0");
    });
  });

  describe("while it loads, fails or is offline", () => {
    it("should show a labelled skeleton while the rows are read", () => {
      show(pending);
      render(<BodyMapScreen />);

      expect(
        screen.getByRole("status", { name: BODY_MAP.dashboardCard.loadingLabel }),
      ).toBeTruthy();
      expect(screen.queryByRole("button", { name: /^Show/ })).toBeNull();
    });

    it("should say the read failed, and read again on Try again", () => {
      show(failed);
      render(<BodyMapScreen />);

      expect(screen.getByText(TRAIN_ERROR.title)).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: TRAIN_ERROR.action }));
      expect(refetch).toHaveBeenCalled();
    });

    it("should say the body map is not available offline when nothing was read", () => {
      show(pending);
      onlineManager.setOnline(false);
      act(() => undefined);
      render(<BodyMapScreen />);

      expect(screen.getByText(TRAIN_OFFLINE_TITLE)).toBeTruthy();
      expect(screen.getByText(BODY_MAP.dashboardCard.offlineUnavailable)).toBeTruthy();
    });

    it("should keep the Back link in every state", () => {
      show(failed);
      render(<BodyMapScreen />);

      expect(screen.getByRole("link", { name: BODY_MAP.back })).toBeTruthy();
    });
  });
});
