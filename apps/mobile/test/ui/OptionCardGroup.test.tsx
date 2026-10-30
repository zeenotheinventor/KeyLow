import { render, screen, userEvent } from "@testing-library/react-native";
import { impactAsync } from "expo-haptics";
import { useState } from "react";
import { setUpTests } from "react-native-reanimated";

import { OptionCardGroup } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { viewsDrawn } from "../support/viewsDrawn";

import type { OptionCardGroupOption } from "../../components/ui";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const mockImpact = jest.mocked(impactAsync);

type Goal = "lose" | "maintain" | "gain";

const question = "What is your goal?";

const goalOptions: readonly OptionCardGroupOption<Goal>[] = [
  { id: "lose", title: "Lose weight", description: "Eat a little less than you use." },
  { id: "maintain", title: "Maintain weight", description: "Eat about what you use." },
  { id: "gain", title: "Gain weight", description: "Eat a little more than you use." },
];

function renderGoals({
  value,
  onChange = () => undefined,
  options = goalOptions,
}: {
  value: Goal | undefined;
  onChange?: (value: Goal) => void;
  options?: readonly OptionCardGroupOption<Goal>[];
}) {
  return render(
    <ThemeProvider fixedPreference="dark">
      <OptionCardGroup label={question} options={options} value={value} onChange={onChange} />
    </ThemeProvider>,
  );
}

// A screen that keeps the answer, as the wizard does.
function GoalStep() {
  const [value, setValue] = useState<Goal | undefined>(undefined);
  return (
    <ThemeProvider fixedPreference="dark">
      <OptionCardGroup label={question} options={goalOptions} value={value} onChange={setValue} />
    </ThemeProvider>
  );
}

describe("OptionCardGroup", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    mockImpact.mockClear();
  });

  describe("what it says", () => {
    it("should be a radio group named by the question", async () => {
      await renderGoals({ value: undefined });

      // A radio group is not itself focusable, so a role query does not reach it. It is found by its name.
      expect(screen.getByLabelText(question)).toHaveProp("role", "radiogroup");
    });

    it("should hold one radio for each option, in order, named by its title and description", async () => {
      await renderGoals({ value: undefined });

      const radios = screen.getAllByRole("radio");
      expect(radios).toHaveLength(3);
      expect(radios[0]).toHaveAccessibleName("Lose weight, Eat a little less than you use");
      expect(radios[1]).toHaveAccessibleName("Maintain weight, Eat about what you use");
      expect(radios[2]).toHaveAccessibleName("Gain weight, Eat a little more than you use");
    });

    it("should have nothing chosen when it has no value, as the first run has", async () => {
      await renderGoals({ value: undefined });

      for (const radio of screen.getAllByRole("radio")) {
        expect(radio).not.toBeChecked();
      }
    });

    it("should say which option is chosen, and only that one", async () => {
      await renderGoals({ value: "maintain" });

      expect(screen.getByRole("radio", { name: /^Maintain weight/ })).toBeChecked();
      expect(screen.getByRole("radio", { name: /^Lose weight/ })).not.toBeChecked();
      expect(screen.getByRole("radio", { name: /^Gain weight/ })).not.toBeChecked();
    });

    it("should leave 8 points between the cards", async () => {
      await renderGoals({ value: undefined });

      expect(screen.getByLabelText(question)).toHaveStyle({ rowGap: 8 });
    });
  });

  describe("choosing", () => {
    it("should hand on the value of the card that is pressed", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      await renderGoals({ value: undefined, onChange });

      await user.press(screen.getByRole("radio", { name: /^Gain weight/ }));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith("gain");
    });

    it("should do nothing when the chosen card is pressed again", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      await renderGoals({ value: "lose", onChange });

      await user.press(screen.getByRole("radio", { name: /^Lose weight/ }));

      expect(onChange).not.toHaveBeenCalled();
    });

    it("should move the choice from one card to another when a screen keeps it", async () => {
      const user = userEvent.setup();
      await render(<GoalStep />);

      await user.press(screen.getByRole("radio", { name: /^Lose weight/ }));
      expect(screen.getByRole("radio", { name: /^Lose weight/ })).toBeChecked();

      await user.press(screen.getByRole("radio", { name: /^Gain weight/ }));
      expect(screen.getByRole("radio", { name: /^Gain weight/ })).toBeChecked();
      expect(screen.getByRole("radio", { name: /^Lose weight/ })).not.toBeChecked();
    });
  });

  describe("an option with a figure at its end, as the rate step has", () => {
    const rates: readonly OptionCardGroupOption<string>[] = [
      {
        id: "gentle",
        title: "0.25% a week",
        value: "0.2 kg",
        valueCaption: "a week",
        valueLabel: "about 0.2 kilograms a week",
      },
      {
        id: "steady",
        title: "0.5% a week",
        value: "0.4 kg",
        valueCaption: "a week",
        valueLabel: "about 0.4 kilograms a week",
      },
    ];

    it("should draw each figure and its caption on its card", async () => {
      await render(
        <ThemeProvider fixedPreference="dark">
          <OptionCardGroup
            label="How fast?"
            options={rates}
            value="steady"
            onChange={() => undefined}
          />
        </ThemeProvider>,
      );

      expect(screen.getByText("0.2 kg")).toBeOnTheScreen();
      expect(screen.getByText("0.4 kg")).toBeOnTheScreen();
      expect(screen.getAllByText("a week")).toHaveLength(2);
    });

    it("should name each card with its spoken figure", async () => {
      await render(
        <ThemeProvider fixedPreference="dark">
          <OptionCardGroup
            label="How fast?"
            options={rates}
            value="steady"
            onChange={() => undefined}
          />
        </ThemeProvider>,
      );

      expect(
        screen.getByRole("radio", { name: "0.5% a week, about 0.4 kilograms a week" }),
      ).toBeChecked();
      expect(
        screen.getByRole("radio", { name: "0.25% a week, about 0.2 kilograms a week" }),
      ).not.toBeChecked();
    });

    it("should hand on the id of the card that is pressed, not its figure", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      await render(
        <ThemeProvider fixedPreference="dark">
          <OptionCardGroup label="How fast?" options={rates} value="steady" onChange={onChange} />
        </ThemeProvider>,
      );

      await user.press(screen.getByRole("radio", { name: /^0.25% a week/ }));

      expect(onChange).toHaveBeenCalledWith("gentle");
    });
  });

  describe("an option that is disabled with a reason", () => {
    const underEighteen: readonly OptionCardGroupOption<Goal>[] = [
      { id: "lose", title: "Lose weight", disabledReason: "Not offered under 18." },
      ...goalOptions.slice(1),
    ];

    it("should name the card with its reason and not choose it when it is pressed", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      await renderGoals({ value: "maintain", onChange, options: underEighteen });

      const lose = screen.getByRole("radio", { name: "Lose weight, Not offered under 18" });
      expect(lose).toBeDisabled();
      await user.press(lose);

      expect(onChange).not.toHaveBeenCalled();
    });

    it("should still let the other cards be chosen", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      await renderGoals({ value: "maintain", onChange, options: underEighteen });

      await user.press(screen.getByRole("radio", { name: /^Gain weight/ }));

      expect(onChange).toHaveBeenCalledWith("gain");
    });

    it("should dim only the disabled card", async () => {
      await renderGoals({ value: "maintain", options: underEighteen });

      expect(viewsDrawn({ opacity: Math.fround(0.4) })).toHaveLength(2);
    });
  });

  describe("when several answers may be chosen", () => {
    type Focus = "v_taper" | "chest" | "arms";

    const focusQuestion = "Anything to focus on?";

    const focusOptions: readonly OptionCardGroupOption<Focus>[] = [
      { id: "v_taper", title: "V-taper", description: "Wider shoulders and back" },
      { id: "chest", title: "Chest", description: "Upper and lower chest" },
      { id: "arms", title: "Arms", description: "Biceps, triceps and forearms" },
    ];

    function renderFocus({
      value,
      onChange = () => undefined,
    }: {
      value: readonly Focus[];
      onChange?: (next: Focus[]) => void;
    }) {
      return render(
        <ThemeProvider fixedPreference="dark">
          <OptionCardGroup
            label={focusQuestion}
            options={focusOptions}
            selection="multiple"
            value={value}
            onChange={onChange}
          />
        </ThemeProvider>,
      );
    }

    function FocusStep() {
      const [value, setValue] = useState<Focus[]>([]);
      return (
        <ThemeProvider fixedPreference="dark">
          <OptionCardGroup
            label={focusQuestion}
            options={focusOptions}
            selection="multiple"
            value={value}
            onChange={setValue}
          />
        </ThemeProvider>
      );
    }

    it("should be a group named by the question, not a radio group", async () => {
      await renderFocus({ value: [] });

      expect(screen.getByLabelText(focusQuestion)).toHaveProp("role", "group");
    });

    it("should hold one checkbox for each option, in order, and no radio", async () => {
      await renderFocus({ value: [] });

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes).toHaveLength(3);
      expect(checkboxes[0]).toHaveAccessibleName("V-taper, Wider shoulders and back");
      expect(screen.queryByRole("radio")).not.toBeOnTheScreen();
    });

    it("should check every option whose id is in the value, and only those", async () => {
      await renderFocus({ value: ["v_taper", "arms"] });

      expect(screen.getByRole("checkbox", { name: /^V-taper/ })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: /^Arms/ })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: /^Chest/ })).not.toBeChecked();
    });

    it("should hand on the chosen ids with the pressed one added at the end", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      await renderFocus({ value: ["arms"], onChange });

      await user.press(screen.getByRole("checkbox", { name: /^V-taper/ }));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(["arms", "v_taper"]);
    });

    it("should hand on the chosen ids without the pressed one when it was checked", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      await renderFocus({ value: ["arms", "chest"], onChange });

      await user.press(screen.getByRole("checkbox", { name: /^Arms/ }));

      expect(onChange).toHaveBeenCalledWith(["chest"]);
    });

    it("should check a card and clear it again when a screen keeps the answer", async () => {
      const user = userEvent.setup();
      await render(<FocusStep />);

      await user.press(screen.getByRole("checkbox", { name: /^Chest/ }));
      await user.press(screen.getByRole("checkbox", { name: /^Arms/ }));
      expect(screen.getByRole("checkbox", { name: /^Chest/ })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: /^Arms/ })).toBeChecked();

      await user.press(screen.getByRole("checkbox", { name: /^Chest/ }));
      expect(screen.getByRole("checkbox", { name: /^Chest/ })).not.toBeChecked();
      expect(screen.getByRole("checkbox", { name: /^Arms/ })).toBeChecked();
    });

    it("should leave 8 points between the cards", async () => {
      await renderFocus({ value: [] });

      expect(screen.getByLabelText(focusQuestion)).toHaveStyle({ rowGap: 8 });
    });
  });
});
