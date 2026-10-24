import "../support/gestureHandler";

import { KeyLowProvider, useWeighIns, useWeightTrend } from "@keylow/api-client";
import { describeChartName } from "@keylow/core/copy";
import { addCalendarDays, toLocalDate } from "@keylow/core/dates";
import { render, screen, userEvent } from "@testing-library/react-native";

import { WeightTrendCard } from "../../components/WeightTrendCard";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import {
  createWeightQueryClient,
  resetWeightBackend,
  weightBackend,
  weightClient,
  weighInRow,
} from "../support/weightBackend";

import type { WeightTrendCardProps } from "../../components/WeightTrendCard";
import type { WeightRange } from "@keylow/core/weight";

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

type RangeProps = Pick<WeightTrendCardProps, "range" | "onRangeChange">;

function CardOverBackend(rangeProps: RangeProps) {
  const weighIns = useWeighIns();
  const trend = useWeightTrend();

  return weighIns.data === undefined ? null : (
    <WeightTrendCard today={today()} trend={trend} weighIns={weighIns.data} {...rangeProps} />
  );
}

function cardOver(rangeProps: RangeProps) {
  return (
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={weightClient} queryClient={createWeightQueryClient()}>
        <CardOverBackend {...rangeProps} />
      </KeyLowProvider>
    </ThemeProvider>
  );
}

const chartImage = (range: WeightRange) =>
  screen.getByRole("image", { name: new RegExp(`^${describeChartName(range, 0).split(", ")[0]}`) });

describe("the trend card with a range it is given", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetWeightBackend();
    seedLoss();
  });

  it("should show the range it is given as the chosen one, and draw the chart over it", async () => {
    await render(cardOver({ range: 30, onRangeChange: jest.fn() }));
    await screen.findByLabelText("Trend weight");

    expect(screen.getByRole("radio", { name: "30 days", checked: true })).toBeOnTheScreen();
    expect(chartImage(30)).toBeOnTheScreen();
  });

  it("should ask for the range that is pressed, and keep the one it was given until it is given another", async () => {
    const onRangeChange = jest.fn<undefined, [WeightRange]>();
    await render(cardOver({ range: 30, onRangeChange }));
    await screen.findByLabelText("Trend weight");

    await userEvent.setup().press(screen.getByRole("radio", { name: "1 year" }));

    expect(onRangeChange).toHaveBeenCalledWith(365);
    expect(screen.getByRole("radio", { name: "30 days", checked: true })).toBeOnTheScreen();
  });

  it("should follow the range when it is given another", async () => {
    const view = await render(cardOver({ range: 30, onRangeChange: jest.fn() }));
    await screen.findByLabelText("Trend weight");

    await view.rerender(cardOver({ range: 7, onRangeChange: jest.fn() }));

    expect(screen.getByRole("radio", { name: "1 week", checked: true })).toBeOnTheScreen();
    expect(chartImage(7)).toBeOnTheScreen();
  });
});
