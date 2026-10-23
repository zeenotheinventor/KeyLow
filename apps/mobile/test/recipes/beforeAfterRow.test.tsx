import { beforeAfterFigures } from "@keylow/core/copy";
import { render, screen, within } from "@testing-library/react-native";

import { BeforeAfterRow } from "../../components/BeforeAfterRow";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { BeforeAfterRowProps } from "../../components/BeforeAfterRow";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

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
