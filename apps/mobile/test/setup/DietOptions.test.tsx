import { cleanup, render, screen, userEvent } from "@testing-library/react-native";

import { DietOptions } from "../../components/SetupOptions";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { DietStyle } from "@keylow/core/setup";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

async function renderOptions(
  value: DietStyle | undefined,
  onChange: (dietStyle: DietStyle) => void = jest.fn(),
) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <DietOptions label="How do you like to eat?" value={value} onChange={onChange} />
    </ThemeProvider>,
  );
}

describe("DietOptions", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/SetupOptions"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  afterEach(async () => {
    await cleanup();
  });

  it("should offer Balanced, Low fat and Low carb in a group named by the given label", async () => {
    await renderOptions(undefined);

    expect(screen.getByLabelText("How do you like to eat?")).toHaveProp("role", "radiogroup");
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(radios[0]).toHaveAccessibleName("Balanced, A mix of both, as most people eat");
    expect(radios[1]).toHaveAccessibleName(
      "Low fat, More bread, rice, pasta and fruit. Less oil and butter",
    );
    expect(radios[2]).toHaveAccessibleName(
      "Low carb, More meat, fish, eggs, dairy and oils. Less bread and rice. Not keto",
    );
  });

  it("should offer no keto style and show no fat fraction", async () => {
    await renderOptions(undefined);

    expect(screen.queryByRole("radio", { name: /^Keto/i })).not.toBeOnTheScreen();
    expect(screen.queryByText(/%/)).not.toBeOnTheScreen();
    expect(screen.queryByText(/0\.4|0\.28|0\.6/)).not.toBeOnTheScreen();
  });

  it("should have nothing chosen when no style is given", async () => {
    await renderOptions(undefined);

    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toBeChecked();
    }
  });

  it("should show the given style as chosen", async () => {
    await renderOptions("low_fat");

    expect(screen.getByRole("radio", { name: /^Low fat/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /^Balanced/ })).not.toBeChecked();
  });

  it.each([
    [/^Balanced/, "balanced"],
    [/^Low fat/, "low_fat"],
    [/^Low carb/, "low_carb"],
  ] as const)("should hand on the style when %s is pressed", async (name, dietStyle) => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    await renderOptions(undefined, onChange);

    await user.press(screen.getByRole("radio", { name }));

    expect(onChange).toHaveBeenCalledWith(dietStyle);
  });
});
