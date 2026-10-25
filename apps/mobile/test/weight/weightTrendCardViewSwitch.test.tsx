import "../support/gestureHandler";

import { KeyLowProvider, useWeighIns, useWeightTrend } from "@keylow/api-client";
import { addCalendarDays, toLocalDate } from "@keylow/core/dates";
import { render, screen, userEvent } from "@testing-library/react-native";
import { Text } from "react-native";

import { WeightTrendCard } from "../../components/WeightTrendCard";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { screenWords } from "../support/screenWords";
import {
  createWeightQueryClient,
  resetWeightBackend,
  weightBackend,
  weightClient,
  weighInRow,
} from "../support/weightBackend";

import type { WeightTrendCardProps } from "../../components/WeightTrendCard";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

const today = () => toLocalDate(new Date(), "Europe/London");

// 91 days of a steady loss of 0.3 kg a week, newest first as the list reads them.
function seedLoss() {
  weightBackend.weighIns = Array.from({ length: 91 }, (_, daysAgo) =>
    weighInRow({
      localDate: addCalendarDays(today(), -daysAgo),
      utcTime: "07:30",
      weightKg: Math.round((80 + daysAgo * (0.3 / 7)) * 1000) / 1000,
      timeZone: "UTC",
    }),
  );
}

type ViewProps = Pick<WeightTrendCardProps, "view" | "onViewChange" | "composition">;

function CardOverBackend(viewProps: ViewProps) {
  const weighIns = useWeighIns();
  const trend = useWeightTrend();

  return weighIns.data === undefined ? null : (
    <WeightTrendCard today={today()} trend={trend} weighIns={weighIns.data} {...viewProps} />
  );
}

async function renderCard(viewProps: ViewProps = {}) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={weightClient} queryClient={createWeightQueryClient()}>
        <CardOverBackend {...viewProps} />
      </KeyLowProvider>
    </ThemeProvider>,
  );
  await screen.findByLabelText("Trend weight");
}

const compositionFigure = <Text>Composition figure</Text>;
const weightImage = () => screen.queryByRole("image", { name: /^Weight over the last 90 days/ });

describe("the trend card's view switch", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetWeightBackend();
    seedLoss();
  });

  describe("without a way to change the view", () => {
    it("should draw no Chart view group, and the weight figure with its legend", async () => {
      await renderCard();

      expect(screen.queryByLabelText("Chart view")).not.toBeOnTheScreen();
      expect(weightImage()).toBeOnTheScreen();
      expect(screen.getByText("Weigh-in")).toBeOnTheScreen();
    });

    it("should keep the weight figure when it is given a composition and no view", async () => {
      await renderCard({ composition: compositionFigure });

      expect(weightImage()).toBeOnTheScreen();
      expect(screen.queryByText("Composition figure")).not.toBeOnTheScreen();
    });
  });

  describe("with a way to change the view", () => {
    it("should offer Chart view with Weight chosen when no view is given", async () => {
      await renderCard({ onViewChange: jest.fn() });

      // The role query does not resolve a radiogroup, so the group is found by its name and checked for its role.
      expect(screen.getByLabelText("Chart view")).toHaveProp("role", "radiogroup");
      expect(screen.getByRole("radio", { name: "Weight", checked: true })).toBeOnTheScreen();
      expect(screen.getByRole("radio", { name: "Composition", checked: false })).toBeOnTheScreen();
    });

    it("should sit between the card and the range control", async () => {
      await renderCard({ onViewChange: jest.fn() });

      const words = screenWords();
      const card = words.indexOf("Trend weight");
      const view = words.indexOf("Chart view");
      const range = words.indexOf("Chart range");

      expect(card).toBeGreaterThan(-1);
      expect(view).toBeGreaterThan(card);
      expect(range).toBeGreaterThan(view);
    });

    it("should ask for the view that is pressed", async () => {
      const onViewChange = jest.fn();
      await renderCard({ onViewChange });

      await userEvent.setup().press(screen.getByRole("radio", { name: "Composition" }));

      expect(onViewChange).toHaveBeenCalledWith("composition");
    });

    it("should keep the view it is given until it is given another", async () => {
      await renderCard({ view: "weight", onViewChange: jest.fn(), composition: compositionFigure });

      await userEvent.setup().press(screen.getByRole("radio", { name: "Composition" }));

      expect(screen.getByRole("radio", { name: "Weight", checked: true })).toBeOnTheScreen();
      expect(weightImage()).toBeOnTheScreen();
    });
  });

  describe("in the Composition view", () => {
    beforeEach(async () => {
      await renderCard({
        view: "composition",
        onViewChange: jest.fn(),
        composition: compositionFigure,
      });
    });

    it("should mark Composition as chosen", () => {
      expect(screen.getByRole("radio", { name: "Composition", checked: true })).toBeOnTheScreen();
    });

    it("should draw what it is given in place of the weight figure and its legend", () => {
      expect(screen.getByText("Composition figure")).toBeOnTheScreen();
      expect(weightImage()).not.toBeOnTheScreen();
      for (const word of ["Trend", "Weigh-in", "Left out"]) {
        expect(screen.queryByText(word)).not.toBeOnTheScreen();
      }
    });

    it("should still draw the trend card and the range control", () => {
      expect(screen.getByLabelText("Trend weight")).toBeOnTheScreen();
      expect(screen.getByRole("radio", { name: "90 days", checked: true })).toBeOnTheScreen();
    });

    it("should draw what it is given under the range control", () => {
      const words = screenWords();

      expect(words.indexOf("Composition figure")).toBeGreaterThan(words.indexOf("Chart range"));
    });
  });

  it("should draw the weight figure in the Composition view when it is given nothing to draw", async () => {
    await renderCard({ view: "composition", onViewChange: jest.fn() });

    expect(weightImage()).toBeOnTheScreen();
  });
});
