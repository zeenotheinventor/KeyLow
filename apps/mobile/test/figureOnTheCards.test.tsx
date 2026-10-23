import { BODY_ARTWORK } from "@keylow/core/training";
import { act, cleanup, render, screen } from "@testing-library/react-native";

import { MusclesTrainedCard } from "../components/MusclesTrainedCard";
import { TrainFirstTime } from "../components/TrainScreen/TrainFirstTime";
import { resetBodyFigureForTests } from "../lib/bodyFigure/testing";
import { ThemeProvider } from "../lib/theme";
import { fillsIn } from "./support/figureFills";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { goldenLegsHeatSets } from "./support/sessionGoldenLegs";

import type { BodyArtworkFigure, BodyArtworkSide } from "@keylow/core/training";
import type { ReactElement } from "react";

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
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

const LEGS_END = "2026-10-15T18:00:00Z";

const cards: readonly {
  name: string;
  figureName: string;
  side: BodyArtworkSide;
  element: ReactElement;
}[] = [
  {
    name: "the Muscles trained card",
    figureName: "This session's heat, front",
    side: "front",
    element: <MusclesTrainedCard at={LEGS_END} sets={goldenLegsHeatSets} />,
  },
  {
    name: "the Train first time screen",
    figureName: "Body map at rest",
    side: "front",
    element: <TrainFirstTime isLogDisabled={false} />,
  },
];

function drawnBody(figureName: string, side: BodyArtworkSide): BodyArtworkFigure | null {
  const [figure] = screen.queryAllByRole("img", { name: figureName });
  const drawn = (["male", "female"] as const).filter(
    (body) =>
      figure?.queryAll(
        (node) =>
          node.type === "RNSVGPath" &&
          Object.getOwnPropertyDescriptor(node.props, "d")?.value ===
            BODY_ARTWORK[body][side].outline,
      ).length === 1,
  );
  return drawn[0] ?? null;
}

describe.each(cards)("the figure on $name", ({ figureName, side, element }) => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/MusclesTrainedCard",
      "components/TrainScreen",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    mockStorageItems.clear();
    mockGetItem.mockReset();
    mockGetItem.mockImplementation(mockReadItem);
    resetBodyFigureForTests();
  });

  afterEach(async () => {
    await cleanup();
  });

  const renderCard = () => render(<ThemeProvider fixedPreference="dark">{element}</ThemeProvider>);

  it("should draw the female figure when that is the setting", async () => {
    mockStorageItems.set("bodyMap.figure", "female");

    await renderCard();

    expect(await screen.findAllByRole("img", { name: figureName })).not.toHaveLength(0);
    expect(drawnBody(figureName, side)).toBe("female");
  });

  it("should draw the male figure when none was chosen, and not ask", async () => {
    await renderCard();

    expect(await screen.findAllByRole("img", { name: figureName })).not.toHaveLength(0);
    expect(drawnBody(figureName, side)).toBe("male");
    expect(screen.queryByLabelText("Figure")).not.toBeOnTheScreen();
  });

  it("should draw no figure until the stored one has been read", async () => {
    let finishRead: (value: string | null) => void = () => undefined;
    mockGetItem.mockImplementation(
      () =>
        new Promise<string | null>((resolve) => {
          finishRead = resolve;
        }),
    );

    await renderCard();

    expect(screen.queryAllByRole("img", { name: figureName })).toHaveLength(0);
    await act(() => {
      finishRead("female");
    });
    expect(await screen.findAllByRole("img", { name: figureName })).not.toHaveLength(0);
    expect(drawnBody(figureName, side)).toBe("female");
  });
});

describe("the Muscles trained card, in female", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/MusclesTrainedCard"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    mockStorageItems.clear();
    mockGetItem.mockReset();
    mockGetItem.mockImplementation(mockReadItem);
    resetBodyFigureForTests();
  });

  afterEach(async () => {
    await cleanup();
  });

  it("should fill the female figure as it fills the male for the same sets", async () => {
    const renderCard = () =>
      render(
        <ThemeProvider fixedPreference="dark">
          <MusclesTrainedCard at={LEGS_END} sets={goldenLegsHeatSets} />
        </ThemeProvider>,
      );
    await renderCard();
    const maleFills = fillsIn(
      await screen.findByRole("img", { name: "This session's heat, front" }),
      "front",
      "male",
    );
    await cleanup();
    resetBodyFigureForTests();
    mockStorageItems.set("bodyMap.figure", "female");

    await renderCard();

    const femaleFills = fillsIn(
      await screen.findByRole("img", { name: "This session's heat, front" }),
      "front",
      "female",
    );
    expect(maleFills.size).toBeGreaterThan(0);
    expect(femaleFills).toEqual(maleFills);
  });
});
