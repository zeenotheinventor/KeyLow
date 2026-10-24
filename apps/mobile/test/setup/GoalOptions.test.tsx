import { cleanup, render, screen, userEvent } from "@testing-library/react-native";

import { GoalOptions } from "../../components/SetupOptions";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { SetupGoal } from "@keylow/core/setup";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

const everyGoal = ["lose", "maintain", "gain"] as const;
const noLose = ["maintain", "gain"] as const;

async function renderOptions({
  allowedGoals,
  value,
  onChange = jest.fn(),
}: {
  allowedGoals: readonly SetupGoal[];
  value: SetupGoal | undefined;
  onChange?: (goal: SetupGoal) => void;
}) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <GoalOptions
        allowedGoals={allowedGoals}
        label="What is your goal?"
        value={value}
        onChange={onChange}
      />
    </ThemeProvider>,
  );
}

describe("GoalOptions", () => {
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

  describe("when every goal is offered", () => {
    it("should offer Lose, Maintain and Gain weight, in that order, in a group named by the given label", async () => {
      await renderOptions({ allowedGoals: everyGoal, value: undefined });

      expect(screen.getByLabelText("What is your goal?")).toHaveProp("role", "radiogroup");
      const radios = screen.getAllByRole("radio");
      expect(radios).toHaveLength(3);
      expect(radios[0]).toHaveAccessibleName("Lose weight, Eat a little less than you use");
      expect(radios[1]).toHaveAccessibleName("Maintain weight, Eat about what you use");
      expect(radios[2]).toHaveAccessibleName("Gain weight, Eat a little more than you use");
    });

    it("should have nothing chosen when no goal is given", async () => {
      await renderOptions({ allowedGoals: everyGoal, value: undefined });

      for (const radio of screen.getAllByRole("radio")) {
        expect(radio).not.toBeChecked();
        expect(radio).toBeEnabled();
      }
    });

    it("should say no reason on any card", async () => {
      await renderOptions({ allowedGoals: everyGoal, value: undefined });

      expect(screen.queryByText("Not offered under 18.")).not.toBeOnTheScreen();
    });

    it.each([
      [/^Lose weight/, "lose"],
      [/^Maintain weight/, "maintain"],
      [/^Gain weight/, "gain"],
    ] as const)("should hand on the goal when %s is pressed", async (name, goal) => {
      const onChange = jest.fn();
      const user = userEvent.setup();
      await renderOptions({ allowedGoals: everyGoal, value: undefined, onChange });

      await user.press(screen.getByRole("radio", { name }));

      expect(onChange).toHaveBeenCalledWith(goal);
    });

    it("should show the given goal as chosen", async () => {
      await renderOptions({ allowedGoals: everyGoal, value: "gain" });

      expect(screen.getByRole("radio", { name: /^Gain weight/ })).toBeChecked();
      expect(screen.getByRole("radio", { name: /^Lose weight/ })).not.toBeChecked();
    });
  });

  describe("when Lose is not offered", () => {
    it("should draw Lose weight disabled, with its reason, named with the reason", async () => {
      await renderOptions({ allowedGoals: noLose, value: undefined });

      const lose = screen.getByRole("radio", { name: "Lose weight, Not offered under 18" });
      expect(lose).toBeDisabled();
      expect(screen.getByText("Not offered under 18.")).toBeOnTheScreen();
      expect(screen.queryByText("Eat a little less than you use.")).not.toBeOnTheScreen();
    });

    it("should do nothing when Lose weight is pressed", async () => {
      const onChange = jest.fn();
      const user = userEvent.setup();
      await renderOptions({ allowedGoals: noLose, value: "maintain", onChange });

      await user.press(screen.getByRole("radio", { name: "Lose weight, Not offered under 18" }));

      expect(onChange).not.toHaveBeenCalled();
    });

    it("should still offer Maintain and Gain weight", async () => {
      const onChange = jest.fn();
      const user = userEvent.setup();
      await renderOptions({ allowedGoals: noLose, value: "maintain", onChange });

      expect(screen.getByRole("radio", { name: /^Maintain weight/ })).toBeEnabled();
      await user.press(screen.getByRole("radio", { name: /^Gain weight/ }));

      expect(onChange).toHaveBeenCalledWith("gain");
    });
  });
});
