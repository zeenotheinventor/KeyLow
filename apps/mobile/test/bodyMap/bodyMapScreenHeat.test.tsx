import { KeyLowProvider, keys, useBodyMap } from "@keylow/api-client";
import { MUSCLE_IDS } from "@keylow/core/training";
import { bodyMapPalette } from "@keylow/tokens";
import { onlineManager } from "@tanstack/react-query";
import {
  act,
  cleanup,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from "@testing-library/react-native";
import { Dimensions } from "react-native";

import { BodyMapScreen } from "../../components/BodyMapScreen";
import { RESTING_HEAT } from "../../components/DashboardScreen/DashboardBodyMapCard";
import { ThemeProvider } from "../../lib/theme";
import { createDiaryQueryClient, diaryClient, resetDiaryBackend } from "../support/diaryBackend";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { fillsIn, heatFill } from "../support/figureFills";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { expectTextsInOrder } from "../support/textsInOrder";
import { resolvedColor } from "../support/themeColor";

import type { BodyMap, TrainingReadResult } from "@keylow/api-client";
import type { MuscleId } from "@keylow/core/training";
import type { ThemeScheme } from "@keylow/tokens";
import type { QueryClient } from "@tanstack/react-query";

// The figure is already chosen (Male), so the screen does not stop to ask. The figure tests cover the question.
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    // The figure is chosen and the first-open hint seen, so this file's screen is the plain one. The hint has a file of its own.
    getItem: (key: string) =>
      Promise.resolve(
        key === "bodyMap.figure" ? "male" : key === "bodyMap.hintSeen" ? "true" : null,
      ),
    setItem: () => Promise.resolve(),
  },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
// 19:00 in London on Thursday 15 October 2026, as the approved boards read it.
jest.mock("../../lib/useNow", () => ({
  useNow: () => new Date("2026-10-15T18:00:00Z"),
}));
// The hook is the one thing replaced: its numbers are core's, pinned by its own tests. This file is about
// what the screen does with them, so it is given the golden values and nothing else is faked.
jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<typeof import("@keylow/api-client")>("@keylow/api-client"),
  useBodyMap: jest.fn(),
}));

// The heat step of every muscle at Thursday 19:00 Actual, as KEY-392 pins it and the approved board draws it.
const goldenSteps: Partial<Record<MuscleId, number>> = {
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
};
const goldenValues: BodyMap["values"] = { ...RESTING_HEAT, ...goldenSteps };

const goldenBodyMap: BodyMap = {
  values: goldenValues,
  computedAt: "2026-10-15T18:00:00.000Z",
  days: [],
  todayProjectedIsActual: true,
  projectedAvailable: true,
  nothingLogged: false,
};

function readResult(data: BodyMap): TrainingReadResult<BodyMap> {
  return { data, isPending: false, isError: false, error: null, refetch: () => Promise.resolve() };
}

// A host node's props are loosely typed, so a prop is read with a descriptor.
function propOf(props: object, name: string): unknown {
  return Object.getOwnPropertyDescriptor(props, name)?.value;
}

// A style can be one object or a list of them, and a later one wins.
function styleProperty(style: unknown, name: string): unknown {
  if (Array.isArray(style)) {
    return style.map((part) => styleProperty(part, name)).findLast((value) => value !== undefined);
  }
  return typeof style === "object" && style !== null ? propOf(style, name) : undefined;
}

const defaultWindow = Dimensions.get("window");

let queryClient: QueryClient;

async function renderScreen(scheme: ThemeScheme = "dark") {
  queryClient = createDiaryQueryClient();
  queryClient.setQueryData(keys.profiles.timeZone, "Europe/London");
  await render(
    <ThemeProvider fixedPreference={scheme}>
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        <BodyMapScreen />
      </KeyLowProvider>
    </ThemeProvider>,
  );
  // The screen waits for the view stored on the phone before it draws the figures and the button.
  await screen.findByRole("button", { name: "Show projected" });
}

const frontName = "Body map, Actual, heat, front";
const backName = "Body map, Actual, heat, back";

describe("the body map screen, Actual heat at Thursday 19:00", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/BodyMapScreen",
      "components/BodyMapCard",
      "components/BodyMapLegend",
      "components/ViewLabel",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    jest.mocked(useBodyMap).mockReturnValue(readResult(goldenBodyMap));
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
    jest.mocked(useBodyMap).mockReset();
    Dimensions.set({ window: defaultWindow });
  });

  describe("reading", () => {
    it("should read Actual heat for the week that holds now, once the terms are accepted", async () => {
      await renderScreen();

      await waitFor(() => {
        expect(useBodyMap).toHaveBeenCalledWith({
          scale: "heat",
          view: "actual",
          weekStart: "2026-10-12",
          now: "2026-10-15T18:00:00.000Z",
          enabled: true,
        });
      });
    });
  });

  describe("the header", () => {
    it("should be titled Body map, with a Back button", async () => {
      await renderScreen();

      expect(screen.getByRole("heading", { name: "Body map" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Back" })).toBeOnTheScreen();
    });

    it("should read Back to Train when it was opened from the Train home", async () => {
      routerMock.searchParams = { from: "train" };
      await renderScreen();

      expect(screen.getByRole("button", { name: "Back to Train" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Back" })).not.toBeOnTheScreen();
    });

    it("should go back when Back to Train is pressed", async () => {
      routerMock.searchParams = { from: "train" };
      await renderScreen();
      const user = userEvent.setup();

      await user.press(screen.getByRole("button", { name: "Back to Train" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should read Back, and go to the Dashboard, when the link naming the Train home was opened cold", async () => {
      routerMock.searchParams = { from: "train" };
      routerMock.canGoBack.mockReturnValue(false);
      await renderScreen();
      const user = userEvent.setup();

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(screen.queryByRole("button", { name: "Back to Train" })).not.toBeOnTheScreen();
      expect(routerMock.replace).toHaveBeenCalledWith("/(tabs)/dashboard");
    });

    it("should read Back for any other origin", async () => {
      routerMock.searchParams = { from: "somewhere" };
      await renderScreen();

      expect(screen.getByRole("button", { name: "Back" })).toBeOnTheScreen();
    });

    it("should go back when Back is pressed", async () => {
      await renderScreen();
      const user = userEvent.setup();

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should go to the Dashboard when there is nothing to go back to, as after a link opened it cold", async () => {
      routerMock.canGoBack.mockReturnValue(false);
      await renderScreen();
      const user = userEvent.setup();

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(routerMock.replace).toHaveBeenCalledWith("/(tabs)/dashboard");
      expect(routerMock.back).not.toHaveBeenCalled();
    });
  });

  describe("the figures", () => {
    it("should draw the front and the back as two images, each with its label", async () => {
      await renderScreen();

      expect(screen.getByRole("img", { name: frontName })).toBeOnTheScreen();
      expect(screen.getByRole("img", { name: backName })).toBeOnTheScreen();
    });

    it.each([
      ["front", frontName],
      ["back", backName],
    ] as const)("should fill each muscle of the %s with its heat step", async (side, name) => {
      await renderScreen();

      const fills = fillsIn(screen.getByRole("img", { name }), side);

      expect(fills.size).toBeGreaterThan(0);
      for (const [muscle, fill] of fills) {
        expect(fill).toEqual(heatFill("dark", goldenValues[muscle]));
      }
    });

    it("should fill a muscle the board draws warm with a warmer step than one it draws rested", async () => {
      await renderScreen();

      const back = fillsIn(screen.getByRole("img", { name: backName }), "back");

      expect(back.get("lats")).toEqual(heatFill("dark", 2));
      expect(back.get("lats")).not.toEqual(back.get("traps_upper"));
    });

    it("should fill the muscles from the light palette in the light theme", async () => {
      await renderScreen("light");

      const back = fillsIn(screen.getByRole("img", { name: backName }), "back");

      expect(back.get("lats")).toEqual(heatFill("light", 2));
    });

    it("should draw each figure 140 points wide and 308 tall, with Front and Back under them", async () => {
      await renderScreen();

      const sized = screen.root?.queryAll(
        (node) =>
          typeof node.type === "string" &&
          styleProperty(node.props.style, "width") === 140 &&
          styleProperty(node.props.style, "height") === 308,
      );
      expect(sized).toHaveLength(2);
      expect(screen.getByText("Front")).toBeOnTheScreen();
      expect(screen.getByText("Back")).toBeOnTheScreen();
    });

    it("should shrink the figures to fit a narrow phone, so they never run out of the card", async () => {
      Dimensions.set({ window: { width: 360, height: 780, scale: 3, fontScale: 1 } });
      await renderScreen();

      // 360 less the screen's 16 each side, the card's 12 and border each side, and the 40 between them, over two.
      const sized = screen.root?.queryAll(
        (node) =>
          typeof node.type === "string" &&
          styleProperty(node.props.style, "width") === 131 &&
          styleProperty(node.props.style, "height") === 288.2,
      );
      expect(sized).toHaveLength(2);
    });

    it("should make each muscle a button for the long press, beside Back, the figure setting and the view toggle", async () => {
      await renderScreen();

      // Back, the figure setting in the header and the view toggle under the figures, then one button for
      // each of the 22 muscles, which the screen reader reaches as the figure's own read-out.
      expect(screen.getAllByRole("button")).toHaveLength(3 + MUSCLE_IDS.length);
      expect(screen.getByRole("button", { name: "Back" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Figure: male or female" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Show projected" })).toBeOnTheScreen();
    });
  });

  describe("the view label", () => {
    it("should read Actual over Now with the day and time", async () => {
      await renderScreen();

      expect(screen.getByRole("status", { name: "Actual" })).toBeOnTheScreen();
      expect(screen.getByText("Now · Thu 15 Oct, 19:00")).toBeOnTheScreen();
    });

    it("should be a polite live region, so a screen reader hears the view named", async () => {
      await renderScreen();

      expect(screen.getByRole("status", { name: "Actual" })).toHaveProp("aria-live", "polite");
    });

    it("should keep the clock's line out of the live region, which would announce it again every minute", async () => {
      await renderScreen();

      const region = screen.getByRole("status", { name: "Actual" });

      expect(within(region).queryByText("Now · Thu 15 Oct, 19:00")).not.toBeOnTheScreen();
    });

    it("should draw the dot of the view in the primary text colour, 8 points across", async () => {
      await renderScreen();

      const [dot] = screen.getByText("Actual").parent?.children ?? [];

      expect(dot).toHaveStyle({
        width: 8,
        height: 8,
        backgroundColor: resolvedColor("dark", "text-primary"),
      });
    });
  });

  describe("the legend", () => {
    it("should be the heat legend, naming the six steps from Rested up to Peak", async () => {
      await renderScreen();

      const legend = screen.getByRole("group", { name: "Heat legend" });

      expectTextsInOrder(within(legend).getAllByText(/./), [
        "Rested",
        "Ready",
        "Warm",
        "Hot",
        "Very hot",
        "Peak",
      ]);
    });

    it("should say how heat is worked out and that it cools", async () => {
      await renderScreen();

      expect(
        screen.getByText("How hard and how recently each muscle worked. It cools as you recover."),
      ).toBeOnTheScreen();
    });

    it("should draw six swatches, 10 points tall, from the rested colour up to the peak colour", async () => {
      await renderScreen();

      const swatches =
        screen.root?.queryAll(
          (node) =>
            typeof node.type === "string" && styleProperty(node.props.style, "height") === 10,
        ) ?? [];

      expect(
        swatches.map((swatch) => styleProperty(swatch.props.style, "backgroundColor")),
      ).toEqual(
        (["heat-0", "heat-1", "heat-2", "heat-3", "heat-4", "heat-5"] as const).map((step) =>
          resolvedColor("dark", step),
        ),
      );
    });

    it("should glow on the peak swatch alone, 8 points of the heat glow colour", async () => {
      await renderScreen();

      const swatches =
        screen.root?.queryAll(
          (node) =>
            typeof node.type === "string" && styleProperty(node.props.style, "height") === 10,
        ) ?? [];

      expect(swatches.at(-1)).toHaveStyle({
        shadowColor: bodyMapPalette("dark").heatGlow,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
      });
      for (const swatch of swatches.slice(0, -1)) {
        expect(styleProperty(swatch.props.style, "shadowRadius")).toBeUndefined();
      }
    });
  });

  describe("only what this ticket builds", () => {
    it("should show the scale switch, and no side switch or muscle list yet", async () => {
      await renderScreen();

      for (const name of [/side shown/i, /muscle list/i, /long-press/i]) {
        expect(screen.queryByLabelText(name)).not.toBeOnTheScreen();
        expect(screen.queryByText(name)).not.toBeOnTheScreen();
      }
      expect(screen.getAllByRole("radio")).toHaveLength(3);
    });

    it("should show no Start a session button, because the Train tab it would open is not there", async () => {
      await renderScreen();

      expect(screen.queryByText("Start a session")).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /start a session/i })).not.toBeOnTheScreen();
    });
  });

  describe("laid out as the board draws it", () => {
    it("should pad the card 12 points and put 8 between its label and its figures", async () => {
      await renderScreen();

      const label = screen.getByRole("status", { name: "Actual" });

      // The label sits with its line in a pair, in the card's column.
      expect(label.parent?.parent).toHaveStyle({ rowGap: 8 });
      expect(label.parent?.parent?.parent).toHaveStyle({ padding: 12, borderWidth: 1 });
    });

    it("should put 40 points between the figures and 4 between each and its name", async () => {
      await renderScreen();

      const front = screen.getByRole("img", { name: frontName });

      // The figure sits in the box that is its fade, the box that holds the old figure over it, and the column.
      const column = front.parent?.parent?.parent?.parent;
      expect(column).toHaveStyle({ rowGap: 4, alignItems: "center" });
      expect(column?.parent).toHaveStyle({
        flexDirection: "row",
        justifyContent: "center",
        columnGap: 40,
      });
    });
  });
});
