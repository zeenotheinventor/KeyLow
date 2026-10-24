import { cleanup, render, screen, userEvent } from "@testing-library/react-native";

import { RateOptions } from "../../components/SetupOptions";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { RateOptionsProps } from "../../components/SetupOptions";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

async function renderOptions(props: Partial<RateOptionsProps> = {}) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <RateOptions
        goal="lose"
        label="How fast do you want to lose weight?"
        value={undefined}
        weightKg={80}
        weightUnit="kg"
        onChange={jest.fn()}
        {...props}
      />
    </ThemeProvider>,
  );
}

describe("RateOptions", () => {
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

  describe("to lose weight", () => {
    it("should offer 0.25, 0.5, 0.75 and 1.0 percent a week in a group named by the given label", async () => {
      await renderOptions();

      expect(screen.getByLabelText("How fast do you want to lose weight?")).toHaveProp(
        "role",
        "radiogroup",
      );
      const radios = screen.getAllByRole("radio");
      expect(radios).toHaveLength(4);
      expect(radios[0]).toHaveAccessibleName(
        "0.25% a week, Gentle, and easy to keep up, about 0.2 kilograms a week",
      );
      expect(radios[1]).toHaveAccessibleName(
        "0.5% a week, Suggested, A steady pace, about 0.4 kilograms a week",
      );
      expect(radios[2]).toHaveAccessibleName(
        "0.75% a week, Faster, and harder to keep up, about 0.6 kilograms a week",
      );
      expect(radios[3]).toHaveAccessibleName(
        "1.0% a week, The fastest Ki-Lo sets, about 0.8 kilograms a week",
      );
    });

    it("should write the weekly amounts in kilograms at 80.0 kg as 0.2, 0.4, 0.6 and 0.8 with a week under each", async () => {
      await renderOptions();

      for (const amount of ["0.2 kg", "0.4 kg", "0.6 kg", "0.8 kg"]) {
        expect(screen.getByText(amount)).toBeOnTheScreen();
      }
      expect(screen.getAllByText("a week")).toHaveLength(4);
    });

    it("should write the weekly amounts in pounds, to one decimal, for a person in pounds", async () => {
      await renderOptions({ weightUnit: "lb" });

      for (const amount of ["0.4 lb", "0.9 lb", "1.3 lb", "1.8 lb"]) {
        expect(screen.getByText(amount)).toBeOnTheScreen();
      }
      expect(
        screen.getByRole("radio", {
          name: "0.5% a week, Suggested, A steady pace, about 0.9 pounds a week",
        }),
      ).toBeOnTheScreen();
    });

    it("should mark only 0.5 percent as Suggested", async () => {
      await renderOptions();

      expect(screen.getAllByText("Suggested")).toHaveLength(1);
      expect(screen.getByRole("radio", { name: /^0\.5% a week, Suggested/ })).toBeOnTheScreen();
    });

    it("should keep the Suggested mark on 0.5 percent when another rate is chosen", async () => {
      await renderOptions({ value: 1.0 });

      expect(screen.getByRole("radio", { name: /^1\.0% a week/ })).toBeChecked();
      expect(screen.getByRole("radio", { name: /^0\.5% a week, Suggested/ })).not.toBeChecked();
    });
  });

  describe("to gain weight", () => {
    const gain: Partial<RateOptionsProps> = {
      goal: "gain",
      label: "How fast do you want to gain weight?",
    };

    it("should offer 0.1, 0.25 and 0.5 percent a week", async () => {
      await renderOptions(gain);

      const radios = screen.getAllByRole("radio");
      expect(radios).toHaveLength(3);
      expect(radios[0]).toHaveAccessibleName(
        "0.1% a week, Slow, and adds the least fat, about 0.1 kilograms a week",
      );
      expect(radios[1]).toHaveAccessibleName(
        "0.25% a week, Suggested, A steady pace, about 0.2 kilograms a week",
      );
      expect(radios[2]).toHaveAccessibleName(
        "0.5% a week, The fastest Ki-Lo sets, about 0.4 kilograms a week",
      );
    });

    it("should write 0.08 kg as 0.1 kg and the others to one decimal", async () => {
      await renderOptions(gain);

      for (const amount of ["0.1 kg", "0.2 kg", "0.4 kg"]) {
        expect(screen.getByText(amount)).toBeOnTheScreen();
      }
    });

    it("should write the amounts at 80.0 kg in pounds as 0.2, 0.4 and 0.9", async () => {
      await renderOptions({ ...gain, weightUnit: "lb" });

      for (const amount of ["0.2 lb", "0.4 lb", "0.9 lb"]) {
        expect(screen.getByText(amount)).toBeOnTheScreen();
      }
    });

    it("should mark only 0.25 percent as Suggested", async () => {
      await renderOptions(gain);

      expect(screen.getAllByText("Suggested")).toHaveLength(1);
      expect(screen.getByRole("radio", { name: /^0\.25% a week, Suggested/ })).toBeOnTheScreen();
    });
  });

  it("should work the amounts from the weight given", async () => {
    await renderOptions({ weightKg: 55 });

    for (const amount of ["0.1 kg", "0.3 kg", "0.4 kg", "0.6 kg"]) {
      expect(screen.getByText(amount)).toBeOnTheScreen();
    }
  });

  it("should have nothing chosen when no rate is given", async () => {
    await renderOptions();

    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toBeChecked();
    }
  });

  it("should show the given rate as chosen", async () => {
    await renderOptions({ value: 0.75 });

    expect(screen.getByRole("radio", { name: /^0\.75% a week/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /^0\.5% a week/ })).not.toBeChecked();
  });

  it.each([
    [/^0\.25% a week/, 0.25],
    [/^0\.5% a week/, 0.5],
    [/^0\.75% a week/, 0.75],
    [/^1\.0% a week/, 1.0],
  ] as const)(
    "should hand on the rate itself, as a number, when %s is pressed",
    async (name, rate) => {
      const onChange = jest.fn();
      const user = userEvent.setup();
      await renderOptions({ onChange });

      await user.press(screen.getByRole("radio", { name }));

      expect(onChange).toHaveBeenCalledWith(rate);
    },
  );
});
