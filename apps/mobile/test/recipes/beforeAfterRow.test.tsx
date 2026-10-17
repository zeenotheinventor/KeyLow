import { render, screen, within } from "@testing-library/react-native";

import { BeforeAfterRow, beforeAfterFigures } from "../../components/BeforeAfterRow";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { BeforeAfterRowProps } from "../../components/BeforeAfterRow";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

describe("the figures of a value before and after", () => {
  it("should write energy in whole kilocalories with the unit once, after the new value", () => {
    expect(beforeAfterFigures("Calories", { before: 374.2, after: 361.7 }, "energy")).toEqual({
      before: "374",
      after: "362 kcal",
      isUnchanged: false,
      accessibleName: "Calories, 374 before, 362 now",
    });
  });

  it("should write grams as the rest of the app writes them", () => {
    expect(beforeAfterFigures("Fat", { before: 8.125, after: 6.75 }, "grams")).toEqual({
      before: "8.1",
      after: "6.8 g",
      isUnchanged: false,
      accessibleName: "Fat, 8.1 before, 6.8 now",
    });
  });

  it("should count two values as the same when they are written the same", () => {
    expect(beforeAfterFigures("Carbs", { before: 42.55, after: 42.6 }, "grams")).toEqual({
      before: "43",
      after: "43 g",
      isUnchanged: true,
      accessibleName: "Carbs, 43 grams, no change",
    });
  });

  it("should write a value the food does not give as not given, with no unit", () => {
    expect(beforeAfterFigures("Fibre", { before: 2, after: null }, "grams")).toEqual({
      before: "2",
      after: "not given",
      isUnchanged: false,
      accessibleName: "Fibre, 2 before, not given now",
    });
  });
});

describe("a row of a value before and after", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/BeforeAfterRow"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  async function renderRow(props: BeforeAfterRowProps) {
    await render(
      <ThemeProvider fixedPreference="dark">
        <BeforeAfterRow {...props} />
      </ThemeProvider>,
    );
  }

  it("should show the old value, an arrow and the new value with its unit, as one stop for a screen reader", async () => {
    await renderRow({
      label: "Calories",
      figures: beforeAfterFigures("Calories", { before: 374.2, after: 361.7 }, "energy"),
    });

    const row = within(screen.getByRole("group", { name: "Calories, 374 before, 362 now" }));
    expect(row.getByText("Calories")).toBeOnTheScreen();
    expect(row.getByText("374")).toBeOnTheScreen();
    expect(row.getByText("362 kcal")).toBeOnTheScreen();
    expect(row.queryByText("no change")).not.toBeOnTheScreen();
  });

  it("should write a figure that did not change once, with no change after it", async () => {
    await renderRow({
      label: "Carbs",
      figures: beforeAfterFigures("Carbs", { before: 42.55, after: 42.55 }, "grams"),
      marker: "carbs",
    });

    const row = within(screen.getByRole("group", { name: "Carbs, 43 grams, no change" }));
    expect(row.getByText("43 g")).toBeOnTheScreen();
    expect(row.getByText("no change")).toBeOnTheScreen();
  });

  it("should leave the label out for a figure that sits under a title that says it", async () => {
    await renderRow({
      figures: beforeAfterFigures("Calories", { before: 600, after: 550 }, "energy"),
      size: "plain",
    });

    const row = within(screen.getByRole("group", { name: "Calories, 600 before, 550 now" }));
    expect(row.queryByText("Calories")).not.toBeOnTheScreen();
    expect(row.getByText("550 kcal")).toBeOnTheScreen();
  });
});
