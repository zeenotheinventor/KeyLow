import { useDashboardBodyMap } from "@keylow/api-client";
import { BODY_ARTWORK } from "@keylow/core/training";
import { act, cleanup, render, screen, userEvent } from "@testing-library/react-native";

import { DashboardBodyMap } from "../../components/DashboardScreen/DashboardBodyMap";
import { DashboardBodyMapCard } from "../../components/DashboardScreen/DashboardBodyMapCard";
import { Button } from "../../components/ui";
import { useBodyFigure } from "../../lib/bodyFigure";
import { resetBodyFigureForTests } from "../../lib/bodyFigure/testing";
import { ThemeProvider } from "../../lib/theme";
import { goldenThursdayBodyMap } from "../support/bodyMapFixtures";
import { fillsIn } from "../support/figureFills";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { TrainingReadResult } from "@keylow/api-client";
import type { BodyArtworkFigure, BodyArtworkSide } from "@keylow/core/training";

const mockStorageItems = new Map<string, string>();
const mockReadItem = (key: string) => Promise.resolve(mockStorageItems.get(key) ?? null);
const mockGetItem = jest.fn(mockReadItem);

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => mockGetItem(key),
    setItem: (key: string, value: string) => {
      mockStorageItems.set(key, value);
      return Promise.resolve();
    },
  },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock("../../lib/useNow", () => ({
  useNow: () => new Date("2026-10-15T16:55:00Z"),
}));
jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<typeof import("@keylow/api-client")>("@keylow/api-client"),
  useDashboardBodyMap: jest.fn(),
}));

const loaded: TrainingReadResult<typeof goldenThursdayBodyMap> = {
  data: goldenThursdayBodyMap,
  isPending: false,
  isError: false,
  error: null,
  refetch: () => Promise.resolve(),
};

// The card's words sit under its one name, so everything inside it is hidden from a screen reader.
const hidden = { includeHiddenElements: true };
const sides = ["front", "back"] as const;
const figureOf = (side: BodyArtworkSide) =>
  screen.getByRole("img", { name: `Body map, Actual, heat, ${side}`, ...hidden });

// Both sides are asked, because each has a figure of its own to give the body to.
function drawsOutlineOf(body: BodyArtworkFigure) {
  return sides.every(
    (side) =>
      figureOf(side).queryAll(
        (node) =>
          node.type === "RNSVGPath" &&
          Object.getOwnPropertyDescriptor(node.props, "d")?.value ===
            BODY_ARTWORK[body][side].outline,
      ).length > 0,
  );
}

// Stands in for the body map screen, which sits over the dashboard and changes the same figure.
function FigureChoice() {
  const { setFigure } = useBodyFigure();
  return (
    <Button
      onPress={() => {
        setFigure("female");
      }}
    >
      Choose female
    </Button>
  );
}

function renderDashboardBodyMap() {
  return render(
    <ThemeProvider fixedPreference="dark">
      <DashboardBodyMap isReadEnabled />
      <FigureChoice />
    </ThemeProvider>,
  );
}

describe("the figure on the dashboard body map card", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/DashboardScreen"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    mockStorageItems.clear();
    mockGetItem.mockReset();
    mockGetItem.mockImplementation(mockReadItem);
    resetBodyFigureForTests();
    jest.mocked(useDashboardBodyMap).mockReturnValue(loaded);
  });

  afterEach(async () => {
    await cleanup();
  });

  it.each(["male", "female"] as const)("should draw the %s figure it is given", async (body) => {
    await render(
      <ThemeProvider fixedPreference="dark">
        <DashboardBodyMapCard
          body={body}
          bodyMap={goldenThursdayBodyMap}
          onOpen={() => undefined}
        />
      </ThemeProvider>,
    );

    expect(drawsOutlineOf(body)).toBe(true);
  });

  it("should fill the female figure as it fills the male for the same values", async () => {
    await render(
      <ThemeProvider fixedPreference="dark">
        <DashboardBodyMapCard
          body="male"
          bodyMap={goldenThursdayBodyMap}
          onOpen={() => undefined}
        />
      </ThemeProvider>,
    );
    const maleFills = fillsIn(figureOf("front"), "front", "male");
    await cleanup();

    await render(
      <ThemeProvider fixedPreference="dark">
        <DashboardBodyMapCard
          body="female"
          bodyMap={goldenThursdayBodyMap}
          onOpen={() => undefined}
        />
      </ThemeProvider>,
    );

    expect(maleFills.size).toBeGreaterThan(0);
    expect(fillsIn(figureOf("front"), "front", "female")).toEqual(maleFills);
  });

  it("should draw the stored figure once it has been read", async () => {
    mockStorageItems.set("bodyMap.figure", "female");

    await renderDashboardBodyMap();

    await screen.findByRole("button", { name: /Open the body map$/ });
    expect(drawsOutlineOf("female")).toBe(true);
  });

  it("should draw Male, and not ask, when no figure was chosen", async () => {
    await renderDashboardBodyMap();

    await screen.findByRole("button", { name: /Open the body map$/ });
    expect(drawsOutlineOf("male")).toBe(true);
    expect(screen.queryByLabelText("Figure")).not.toBeOnTheScreen();
  });

  it("should not draw a figure until the stored one has been read", async () => {
    let finishRead: (value: string | null) => void = () => undefined;
    mockGetItem.mockImplementation(
      () =>
        new Promise<string | null>((resolve) => {
          finishRead = resolve;
        }),
    );

    await renderDashboardBodyMap();

    expect(screen.getByRole("status", { name: "Loading the body map" })).toBeOnTheScreen();
    expect(screen.queryByRole("img", { name: /Body map/, ...hidden })).not.toBeOnTheScreen();
    await act(() => {
      finishRead("female");
    });
    await screen.findByRole("button", { name: /Open the body map$/ });
    expect(drawsOutlineOf("female")).toBe(true);
  });

  it("should change to the figure chosen on the body map screen, which sits over it", async () => {
    const user = userEvent.setup();
    await renderDashboardBodyMap();
    await screen.findByRole("button", { name: /Open the body map$/ });

    await user.press(screen.getByRole("button", { name: "Choose female" }));

    expect(drawsOutlineOf("female")).toBe(true);
  });
});
