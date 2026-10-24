import { WEIGHT_SCREEN, describeBodyRangeEmpty } from "@keylow/core/copy";
import { render, screen, within } from "@testing-library/react-native";

import { BodyCompositionCard } from "../../components/BodyCompositionCard";
import * as stories from "../../components/BodyCompositionCard/BodyCompositionCard.stories";
import { storyStates } from "../../components/BodyCompositionCard/storyStates";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { BodyCompositionCardProps } from "../../components/BodyCompositionCard";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// Skia draws nothing in Jest. The canvas, path and circle here are views that keep the props they were given.
jest.mock("@shopify/react-native-skia", () => {
  const { createElement } = jest.requireActual<typeof import("react")>("react");
  const drawing = (name: string) => (props: object) => createElement(name, props);
  return {
    __esModule: true,
    Canvas: drawing("Canvas"),
    Path: drawing("Path"),
    Circle: drawing("Circle"),
  };
});

const line = [22.9, null, 22.8, 22.6, 22.5, 22.4];

const bodyFat: BodyCompositionCardProps = {
  kind: "body_fat_pct",
  trend: 22.44,
  range: 90,
  state: "chart",
  change: -0.6,
  line,
};
const leanMass: BodyCompositionCardProps = {
  kind: "lean_mass_kg",
  trend: 63.14,
  range: 90,
  state: "chart",
  change: -0.2,
  line,
};

async function renderCard(props: BodyCompositionCardProps) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <BodyCompositionCard {...props} />
    </ThemeProvider>,
  );
}

describe("BodyCompositionCard", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/BodyCompositionCard"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  describe("with a settled trend and a change", () => {
    it("should say body fat in a card named by its label, with the value, the unit and the change", async () => {
      await renderCard(bodyFat);

      const card = within(screen.getByLabelText("Body fat"));

      expect(card.getByText("Body fat")).toBeOnTheScreen();
      expect(card.getByText("−0.6 points over 90 days")).toBeOnTheScreen();
      expect(card.getByText("22.4")).toBeOnTheScreen();
      expect(card.getByText("%")).toBeOnTheScreen();
    });

    it("should say lean mass in kilograms with its change in kilograms", async () => {
      await renderCard(leanMass);

      const card = within(screen.getByLabelText("Lean mass"));

      expect(card.getByText("−0.2 kg over 90 days")).toBeOnTheScreen();
      expect(card.getByText("63.1")).toBeOnTheScreen();
      expect(card.getByText("kg")).toBeOnTheScreen();
    });

    it("should draw the trend line as an image named by the kind, the span and the trend", async () => {
      await renderCard(bodyFat);

      expect(
        screen.getByRole("img", { name: "Body fat over the last 90 days, trend 22.4 %" }),
      ).toBeOnTheScreen();
    });

    it("should name the line for lean mass", async () => {
      await renderCard(leanMass);

      expect(
        screen.getByRole("img", { name: "Lean mass over the last 90 days, trend 63.1 kg" }),
      ).toBeOnTheScreen();
    });

    it("should name the span of the range it was given", async () => {
      await renderCard({ ...bodyFat, range: 30, change: 0.4 });

      expect(screen.getByText("+0.4 points over 30 days")).toBeOnTheScreen();
      expect(
        screen.getByRole("img", { name: "Body fat over the last 30 days, trend 22.4 %" }),
      ).toBeOnTheScreen();
    });

    it("should draw the line the card was given, wide", async () => {
      await renderCard(bodyFat);

      const canvases = screen.root?.queryAll((node) => node.type === "Canvas") ?? [];

      expect(canvases[0]).toHaveStyle({ width: 128, height: 40 });
    });

    it("should have no settling badge and no note", async () => {
      await renderCard(bodyFat);

      expect(screen.queryByText(WEIGHT_SCREEN.settlingBadge)).not.toBeOnTheScreen();
      expect(screen.queryByText(/Settles after/)).not.toBeOnTheScreen();
      expect(screen.queryByText(/Not enough readings/)).not.toBeOnTheScreen();
    });
  });

  describe("while the trend settles", () => {
    const settling: BodyCompositionCardProps = {
      kind: "body_fat_pct",
      trend: 22.6,
      range: 90,
      state: "settling",
      readingCount: 3,
    };

    it("should show the value, the Settling badge and how many readings it has", async () => {
      await renderCard(settling);

      expect(screen.getByText("22.6")).toBeOnTheScreen();
      expect(screen.getByText("Settling")).toBeOnTheScreen();
      expect(screen.getByText("Settles after 7 readings. 3 of 7 so far.")).toBeOnTheScreen();
    });

    it("should have no change badge and no trend line", async () => {
      await renderCard(settling);

      expect(screen.queryByText(/over 90 days/)).not.toBeOnTheScreen();
      expect(screen.queryByRole("img")).not.toBeOnTheScreen();
    });
  });

  describe("when the range holds too few readings", () => {
    it.each([7, 30, 90, 365] as const)(
      "should show the value and the reason over %i days, with no badge and no line",
      async (range) => {
        await renderCard({ kind: "lean_mass_kg", trend: 63.1, range, state: "range-empty" });

        expect(screen.getByText("63.1")).toBeOnTheScreen();
        expect(screen.getByText(describeBodyRangeEmpty(range))).toBeOnTheScreen();
        expect(screen.queryByText(WEIGHT_SCREEN.settlingBadge)).not.toBeOnTheScreen();
        expect(screen.queryByText(/ over /)).not.toBeOnTheScreen();
        expect(screen.queryByRole("img")).not.toBeOnTheScreen();
      },
    );

    it("should say the board's words for the last week", async () => {
      await renderCard({ kind: "body_fat_pct", trend: 22.6, range: 7, state: "range-empty" });

      expect(
        screen.getByText("Not enough readings in the last week to show a change."),
      ).toBeOnTheScreen();
    });
  });

  it("should have a story for each state it lists, and no other", () => {
    expect(
      Object.keys(stories)
        .filter((name) => name !== "default")
        .sort(),
    ).toEqual([...storyStates].sort());
  });
});
