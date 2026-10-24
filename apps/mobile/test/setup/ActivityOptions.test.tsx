import { cleanup, render, screen, userEvent } from "@testing-library/react-native";

import { ActivityOptions } from "../../components/SetupOptions";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { ActivityLevel } from "@keylow/core/engine";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

async function renderOptions(
  value: ActivityLevel | undefined,
  onChange: (activity: ActivityLevel) => void = jest.fn(),
) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <ActivityOptions label="How active are you?" value={value} onChange={onChange} />
    </ThemeProvider>,
  );
}

describe("ActivityOptions", () => {
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

  it("should offer the five levels, from Sedentary to Extra active, in a group named by the given label", async () => {
    await renderOptions(undefined);

    expect(screen.getByLabelText("How active are you?")).toHaveProp("role", "radiogroup");
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(5);
    expect(radios[0]).toHaveAccessibleName("Sedentary, Mostly sitting, with little or no exercise");
    expect(radios[1]).toHaveAccessibleName(
      "Lightly active, Some walking, or exercise 1 to 3 days a week",
    );
    expect(radios[2]).toHaveAccessibleName(
      "Moderately active, On your feet a lot, or exercise 3 to 5 days a week",
    );
    expect(radios[3]).toHaveAccessibleName(
      "Very active, A physical job, or hard exercise 6 or 7 days a week",
    );
    expect(radios[4]).toHaveAccessibleName(
      "Extra active, A physical job and daily training, or training twice a day",
    );
  });

  it("should say each level in words and show no activity factor", async () => {
    await renderOptions(undefined);

    expect(screen.getByText("Some walking, or exercise 1 to 3 days a week.")).toBeOnTheScreen();
    expect(screen.queryByText(/1\.2|1\.375|1\.55|1\.725|1\.9/)).not.toBeOnTheScreen();
    expect(screen.queryByText(/×|\bx\b/)).not.toBeOnTheScreen();
  });

  it("should have nothing chosen when no level is given", async () => {
    await renderOptions(undefined);

    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toBeChecked();
    }
  });

  it("should show the given level as chosen", async () => {
    await renderOptions("light");

    expect(screen.getByRole("radio", { name: /^Lightly active/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /^Sedentary/ })).not.toBeChecked();
  });

  it.each([
    [/^Sedentary/, "sedentary"],
    [/^Lightly active/, "light"],
    [/^Moderately active/, "moderate"],
    [/^Very active/, "very"],
    [/^Extra active/, "extra"],
  ] as const)("should hand on the level when %s is pressed", async (name, level) => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    await renderOptions(undefined, onChange);

    await user.press(screen.getByRole("radio", { name }));

    expect(onChange).toHaveBeenCalledWith(level);
  });
});
