import { cleanup, render, screen, userEvent } from "@testing-library/react-native";

import { ProteinOptions } from "../../components/SetupOptions";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { ProteinPreset } from "@keylow/core/setup";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

async function renderOptions(
  value: ProteinPreset | undefined,
  {
    weightKg = 80,
    onChange = jest.fn(),
  }: { weightKg?: number; onChange?: (p: ProteinPreset) => void } = {},
) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <ProteinOptions
        label="How much protein?"
        value={value}
        weightKg={weightKg}
        onChange={onChange}
      />
    </ThemeProvider>,
  );
}

describe("ProteinOptions", () => {
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

  it("should offer Moderate, High and Very high in a group named by the given label", async () => {
    await renderOptions(undefined);

    expect(screen.getByLabelText("How much protein?")).toHaveProp("role", "radiogroup");
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(radios[0]).toHaveAccessibleName(
      "Moderate, 1.6 g per kg of body weight. Enough for most people, 128 g a day",
    );
    expect(radios[1]).toHaveAccessibleName(
      "High, 2.0 g per kg. Suits regular strength training, 160 g a day",
    );
    expect(radios[2]).toHaveAccessibleName(
      "Very high, 2.2 g per kg. Helps keep muscle while you lose weight, 176 g a day",
    );
  });

  it("should write the grams at 80.0 kg as 128, 160 and 176 with a day under each", async () => {
    await renderOptions(undefined);

    for (const grams of ["128 g", "160 g", "176 g"]) {
      expect(screen.getByText(grams)).toBeOnTheScreen();
    }
    expect(screen.getAllByText("a day")).toHaveLength(3);
  });

  it("should round the grams to whole grams at 77.3 kg", async () => {
    await renderOptions(undefined, { weightKg: 77.3 });

    for (const grams of ["124 g", "155 g", "170 g"]) {
      expect(screen.getByText(grams)).toBeOnTheScreen();
    }
  });

  it("should have nothing chosen when no preset is given", async () => {
    await renderOptions(undefined);

    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toBeChecked();
    }
  });

  it("should show the given preset as chosen", async () => {
    await renderOptions("high");

    expect(screen.getByRole("radio", { name: /^High/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /^Moderate/ })).not.toBeChecked();
  });

  it.each([
    [/^Moderate/, "moderate"],
    [/^High/, "high"],
    [/^Very high/, "very_high"],
  ] as const)("should hand on the preset when %s is pressed", async (name, preset) => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    await renderOptions(undefined, { onChange });

    await user.press(screen.getByRole("radio", { name }));

    expect(onChange).toHaveBeenCalledWith(preset);
  });
});
