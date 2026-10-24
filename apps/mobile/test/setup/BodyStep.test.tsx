import { cleanup, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { useReducer } from "react";

import {
  initialSetupWizardState,
  setupWizardReducer,
} from "../../components/SetupScreen/setupDraftReducer";
import { BodyStep } from "../../components/SetupScreen/steps/BodyStep";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";
import { viewsDrawn } from "../support/viewsDrawn";

import type { BodyAnswers } from "../../components/SetupScreen/steps/BodyStep";
import type { WeightDisplayUnit } from "@keylow/core/weight";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

const TODAY = "2026-10-23";

type Start = {
  heightCm?: number;
  weightKg?: number;
  weightUnit?: WeightDisplayUnit;
  weighInDate?: string;
  onChange?: (body: BodyAnswers) => void;
};

// The step as the wizard holds it: its answers come back from the real reducer, as they do in the screen.
function Wizard({ heightCm, weightKg, weightUnit = "kg", weighInDate, onChange }: Start) {
  const [state, dispatch] = useReducer(setupWizardReducer, {
    ...initialSetupWizardState,
    draft: {
      ...(heightCm === undefined ? {} : { heightCm }),
      ...(weightKg === undefined ? {} : { weightKg }),
      weightUnit,
    },
    weightFromWeighInOn: weighInDate,
  });
  return (
    <BodyStep
      heightCm={state.draft.heightCm}
      today={TODAY}
      weighInDate={state.weightFromWeighInOn}
      weightKg={state.draft.weightKg}
      weightUnit={state.draft.weightUnit ?? weightUnit}
      onChange={(body) => {
        onChange?.(body);
        dispatch({ type: "bodyChanged", ...body });
      }}
    />
  );
}

async function renderStep(start: Start = {}) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <Wizard {...start} />
    </ThemeProvider>,
  );
}

const centimetres = () => screen.getByLabelText("Height in centimetres");
const feet = () => screen.getByLabelText("Height, feet");
const inches = () => screen.getByLabelText("Height, inches");
const kilograms = () => screen.getByLabelText("Weight in kilograms");
const pounds = () => screen.getByLabelText("Weight in pounds");
const imperialUnits = () => screen.getByRole("radio", { name: "lb, ft, in" });
const metricUnits = () => screen.getByRole("radio", { name: "kg, cm" });

// The unit after a value is decoration, so a screen reader skips it.
const shownToo = { includeHiddenElements: true };

const dangerBorders = () => viewsDrawn({ borderColor: resolvedColor("dark", "danger") });

describe("BodyStep", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/SetupScreen"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
  });

  describe("in kilograms and centimetres", () => {
    it("should offer Units as a small two-option switch named kg, cm and lb, ft, in, with kg, cm chosen", async () => {
      await renderStep();

      expect(screen.getByLabelText("Units")).toHaveProp("role", "radiogroup");
      expect(metricUnits()).toBeChecked();
      expect(imperialUnits()).not.toBeChecked();
    });

    it("should draw the height and the weight as two groups, each named by its label", async () => {
      await renderStep({ heightCm: 180, weightKg: 80 });

      expect(screen.getByLabelText("Height")).toHaveProp("role", "group");
      expect(screen.getByLabelText("Weight")).toHaveProp("role", "group");
      expect(screen.getByText("Height")).toBeOnTheScreen();
      expect(screen.getByText("Weight")).toBeOnTheScreen();
    });

    it("should show 180 cm and 80.0 kg, each with its unit after it", async () => {
      await renderStep({ heightCm: 180, weightKg: 80 });

      expect(centimetres()).toHaveDisplayValue("180");
      expect(kilograms()).toHaveDisplayValue("80.0");
      expect(screen.getByText("cm", shownToo)).toBeOnTheScreen();
      expect(screen.getByText("kg", shownToo)).toBeOnTheScreen();
      expect(screen.queryByLabelText("Height, feet")).not.toBeOnTheScreen();
      expect(screen.queryByLabelText("Weight in pounds")).not.toBeOnTheScreen();
    });

    it("should be empty, with no error and no source line, when nothing is given", async () => {
      await renderStep();

      expect(centimetres()).toHaveDisplayValue("");
      expect(kilograms()).toHaveDisplayValue("");
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
      expect(screen.queryByText(/^From your weigh-in/)).not.toBeOnTheScreen();
    });

    it("should ask for the decimal pad for the height in centimetres and for the weight", async () => {
      await renderStep();

      expect(centimetres()).toHaveProp("keyboardType", "decimal-pad");
      expect(kilograms()).toHaveProp("keyboardType", "decimal-pad");
    });
  });

  describe("in pounds, feet and inches", () => {
    it("should show 5 ft 11 in and 176.4 lb for 180 cm and 80.0 kg, each with its unit after it", async () => {
      await renderStep({ heightCm: 180, weightKg: 80, weightUnit: "lb" });

      expect(imperialUnits()).toBeChecked();
      expect(feet()).toHaveDisplayValue("5");
      expect(inches()).toHaveDisplayValue("11");
      expect(pounds()).toHaveDisplayValue("176.4");
      expect(screen.getByText("ft", shownToo)).toBeOnTheScreen();
      expect(screen.getByText("in", shownToo)).toBeOnTheScreen();
      expect(screen.getByText("lb", shownToo)).toBeOnTheScreen();
      expect(screen.queryByLabelText("Height in centimetres")).not.toBeOnTheScreen();
      expect(screen.queryByLabelText("Weight in kilograms")).not.toBeOnTheScreen();
    });

    it("should ask for the number pad for the feet and the inches, which have no decimal, and the decimal pad for the weight", async () => {
      await renderStep({ weightUnit: "lb" });

      expect(feet()).toHaveProp("keyboardType", "number-pad");
      expect(inches()).toHaveProp("keyboardType", "number-pad");
      expect(pounds()).toHaveProp("keyboardType", "decimal-pad");
    });

    it("should draw the feet and the inches beside each other under one Height label", async () => {
      await renderStep({ weightUnit: "lb" });

      expect(screen.getAllByText("Height")).toHaveLength(1);
      expect(screen.getByLabelText("Height")).toHaveProp("role", "group");
    });
  });

  describe("what it hands on", () => {
    it("should hand on the height in centimetres and the weight in kilograms as they are typed", async () => {
      const onChange = jest.fn();
      const user = userEvent.setup();
      await renderStep({ onChange });

      await user.type(centimetres(), "180");
      await user.type(kilograms(), "80.5");

      expect(onChange).toHaveBeenLastCalledWith({
        heightCm: 180,
        weightKg: 80.5,
        weightUnit: "kg",
      });
    });

    it("should hand on feet and inches as centimetres and pounds as kilograms", async () => {
      const onChange = jest.fn();
      const user = userEvent.setup();
      await renderStep({ weightUnit: "lb", onChange });

      await user.type(feet(), "5");
      await user.type(inches(), "11");
      await user.type(pounds(), "176.4");

      expect(onChange).toHaveBeenLastCalledWith({
        heightCm: 180.34,
        weightKg: 80.014,
        weightUnit: "lb",
      });
    });

    it("should hand on nothing for a height or a weight that cannot be used", async () => {
      const onChange = jest.fn();
      const user = userEvent.setup();
      await renderStep({ heightCm: 180, weightKg: 80, onChange });

      await user.clear(centimetres());
      await user.clear(kilograms());
      await user.type(kilograms(), "4");

      expect(onChange).toHaveBeenLastCalledWith({
        heightCm: undefined,
        weightKg: undefined,
        weightUnit: "kg",
      });
    });
  });

  describe("editing one field", () => {
    it("should leave a saved height of 178 cm at 178 in feet and inches when the weight is edited", async () => {
      const onChange = jest.fn();
      const user = userEvent.setup();
      await renderStep({ heightCm: 178, weightKg: 80, weightUnit: "lb", onChange });

      await user.clear(pounds());
      await user.type(pounds(), "150");

      expect(onChange).toHaveBeenLastCalledWith({
        heightCm: 178,
        weightKg: 68.039,
        weightUnit: "lb",
      });
    });

    it("should leave a weigh-in of 80.123 kg, and its source line, alone when the height is edited", async () => {
      const onChange = jest.fn();
      const user = userEvent.setup();
      await renderStep({ weightKg: 80.123, weighInDate: "2026-10-21", onChange });

      await user.type(centimetres(), "180");

      expect(onChange).toHaveBeenLastCalledWith({
        heightCm: 180,
        weightKg: 80.123,
        weightUnit: "kg",
      });
      expect(screen.getByText("From your weigh-in on 21 Oct")).toBeOnTheScreen();
    });

    it("should leave a weigh-in shown in pounds, and its source line, alone when the feet are edited", async () => {
      const onChange = jest.fn();
      const user = userEvent.setup();
      await renderStep({
        weightKg: 80.123,
        weightUnit: "lb",
        weighInDate: "2026-10-21",
        onChange,
      });

      await user.type(feet(), "5");

      expect(onChange).toHaveBeenLastCalledWith({
        heightCm: undefined,
        weightKg: 80.123,
        weightUnit: "lb",
      });
      expect(screen.getByText("From your weigh-in on 21 Oct")).toBeOnTheScreen();
    });
  });

  describe("switching the units", () => {
    it("should read 180 cm as 5 ft 11 in and 80.0 kg as 176.4 lb", async () => {
      const user = userEvent.setup();
      await renderStep({ heightCm: 180, weightKg: 80 });

      await user.press(imperialUnits());

      expect(imperialUnits()).toBeChecked();
      expect(feet()).toHaveDisplayValue("5");
      expect(inches()).toHaveDisplayValue("11");
      expect(pounds()).toHaveDisplayValue("176.4");
    });

    it("should hand on the same centimetres and kilograms, with the new unit", async () => {
      const onChange = jest.fn();
      const user = userEvent.setup();
      await renderStep({ heightCm: 180, weightKg: 80, onChange });

      await user.press(imperialUnits());

      expect(onChange).toHaveBeenLastCalledWith({
        heightCm: 180,
        weightKg: 80,
        weightUnit: "lb",
      });
    });

    it("should give back the same height and weight when switched back", async () => {
      const onChange = jest.fn();
      const user = userEvent.setup();
      await renderStep({ heightCm: 180, weightKg: 80, onChange });

      await user.press(imperialUnits());
      await user.press(metricUnits());

      expect(centimetres()).toHaveDisplayValue("180");
      expect(kilograms()).toHaveDisplayValue("80.0");
      expect(onChange).toHaveBeenLastCalledWith({
        heightCm: 180,
        weightKg: 80,
        weightUnit: "kg",
      });
    });

    it("should not drift a weight typed in pounds when it goes to kilograms and back", async () => {
      const user = userEvent.setup();
      await renderStep({ weightUnit: "lb" });
      await user.type(pounds(), "150.0");

      await user.press(metricUnits());
      expect(kilograms()).toHaveDisplayValue("68.0");
      await user.press(imperialUnits());

      expect(pounds()).toHaveDisplayValue("150.0");
    });

    it("should clear the weight, and keep the height, when the weight typed cannot be used", async () => {
      const user = userEvent.setup();
      await renderStep({ heightCm: 180 });
      await user.type(kilograms(), "4");

      await user.press(imperialUnits());

      expect(pounds()).toHaveDisplayValue("");
      expect(feet()).toHaveDisplayValue("5");
      expect(inches()).toHaveDisplayValue("11");
    });

    it("should say nothing of a field it has cleared", async () => {
      const user = userEvent.setup();
      await renderStep({ heightCm: 180 });
      await user.type(kilograms(), "4");
      expect(screen.getByRole("alert")).toBeOnTheScreen();

      await user.press(imperialUnits());

      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });

    it("should keep the weigh-in's source line, because the weight is the same number", async () => {
      const user = userEvent.setup();
      await renderStep({ weightKg: 80, weighInDate: "2026-10-21" });

      await user.press(imperialUnits());

      expect(screen.getByText("From your weigh-in on 21 Oct")).toBeOnTheScreen();
    });
  });

  describe("the weigh-in the weight came from", () => {
    it("should say where the weight came from, with its date", async () => {
      await renderStep({ heightCm: 180, weightKg: 80, weighInDate: "2026-10-21" });

      expect(kilograms()).toHaveDisplayValue("80.0");
      expect(screen.getByText("From your weigh-in on 21 Oct")).toBeOnTheScreen();
    });

    it("should say today for a weigh-in made today", async () => {
      await renderStep({ weightKg: 80, weighInDate: TODAY });

      expect(screen.getByText("From your weigh-in today")).toBeOnTheScreen();
    });

    it("should say nothing when the weight did not come from a weigh-in", async () => {
      await renderStep({ weightKg: 80 });

      expect(screen.queryByText(/^From your weigh-in/)).not.toBeOnTheScreen();
    });

    it("should drop the line once the number is changed, and not bring it back when it is typed back", async () => {
      const user = userEvent.setup();
      await renderStep({ weightKg: 80, weighInDate: "2026-10-21" });

      await user.type(kilograms(), "1", { skipBlur: true });
      expect(screen.queryByText(/^From your weigh-in/)).not.toBeOnTheScreen();

      await user.clear(kilograms());
      await user.type(kilograms(), "80.0");

      expect(screen.queryByText(/^From your weigh-in/)).not.toBeOnTheScreen();
    });

    it("should keep the line for a weight that is not edited, though the height is", async () => {
      const user = userEvent.setup();
      await renderStep({ weightKg: 80, weighInDate: "2026-10-21" });

      await user.type(centimetres(), "180");

      expect(screen.getByText("From your weigh-in on 21 Oct")).toBeOnTheScreen();
    });
  });

  describe("when the error shows", () => {
    it("should wait until the height is left when it is too low, because more digits may mend it", async () => {
      const user = userEvent.setup();
      await renderStep();

      await user.type(centimetres(), "18", { skipBlur: true });

      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
      expect(dangerBorders()).toHaveLength(0);

      await fireEvent(centimetres(), "blur");

      expect(screen.getByRole("alert")).toHaveTextContent("Enter a height between 100 and 250 cm.");
    });

    it("should show a height that is too high at once", async () => {
      const user = userEvent.setup();
      await renderStep();

      await user.type(centimetres(), "300", { skipBlur: true });

      expect(screen.getByRole("alert")).toHaveTextContent("Enter a height between 100 and 250 cm.");
    });

    it("should show too many decimals at once, in the weigh-in sheet's words", async () => {
      const user = userEvent.setup();
      await renderStep();

      await user.type(kilograms(), "80.55", { skipBlur: true });

      expect(screen.getByRole("alert")).toHaveTextContent("Up to one decimal place.");
    });

    it("should wait until the weight is left when it is too low", async () => {
      const user = userEvent.setup();
      await renderStep();

      await user.type(kilograms(), "8", { skipBlur: true });
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();

      await fireEvent(kilograms(), "blur");

      expect(screen.getByRole("alert")).toHaveTextContent("Enter a weight between 20 and 400 kg.");
    });

    it("should say nothing of an empty field that has been left", async () => {
      await renderStep();

      await fireEvent(centimetres(), "blur");
      await fireEvent(kilograms(), "blur");

      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });

    it("should show a saved height that is out of range at once, because it was not typed", async () => {
      await renderStep({ heightCm: 90 });

      expect(screen.getByRole("alert")).toHaveTextContent("Enter a height between 100 and 250 cm.");
    });

    it("should clear the error once the number is mended", async () => {
      const user = userEvent.setup();
      await renderStep();
      await user.type(centimetres(), "90");
      expect(screen.getByRole("alert")).toBeOnTheScreen();

      await user.clear(centimetres());
      await user.type(centimetres(), "180");

      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });
  });

  describe("the errors", () => {
    it("should say the height and the weight bounds in kilograms and centimetres, under each field, and border it in danger", async () => {
      const user = userEvent.setup();
      await renderStep();

      await user.type(centimetres(), "18");
      await user.type(kilograms(), "4");

      const alerts = screen.getAllByRole("alert");
      expect(alerts).toHaveLength(2);
      expect(alerts[0]).toHaveTextContent("Enter a height between 100 and 250 cm.");
      expect(alerts[1]).toHaveTextContent("Enter a weight between 20 and 400 kg.");
      expect(dangerBorders()).toHaveLength(2);
    });

    it("should say them in feet and inches and pounds, and border both the feet and the inches", async () => {
      const user = userEvent.setup();
      await renderStep({ weightUnit: "lb" });

      await user.type(feet(), "2");
      await user.type(inches(), "5");
      await user.type(pounds(), "10");

      const alerts = screen.getAllByRole("alert");
      expect(alerts).toHaveLength(2);
      expect(alerts[0]).toHaveTextContent("Enter a height between 3 ft 4 in and 8 ft 2 in.");
      expect(alerts[1]).toHaveTextContent("Enter a weight between 45 and 881 lb.");
      expect(dangerBorders()).toHaveLength(3);
    });

    it("should say that the inches are under 12 for 12 inches, as the height's range", async () => {
      const user = userEvent.setup();
      await renderStep({ weightUnit: "lb" });

      await user.type(feet(), "5");
      await user.type(inches(), "12", { skipBlur: true });

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Enter a height between 3 ft 4 in and 8 ft 2 in.",
      );
    });

    it("should describe each field by its error, as a native field says it is invalid", async () => {
      const user = userEvent.setup();
      await renderStep();

      await user.type(centimetres(), "18");

      expect(centimetres()).toHaveProp(
        "accessibilityHint",
        "Enter a height between 100 and 250 cm.",
      );
    });

    it("should hide the weigh-in's source line behind a weight error", async () => {
      await renderStep({ weightKg: 5, weighInDate: "2026-10-21" });

      expect(screen.getByRole("alert")).toHaveTextContent("Enter a weight between 20 and 400 kg.");
      expect(screen.queryByText(/^From your weigh-in/)).not.toBeOnTheScreen();
    });
  });

  describe("an answer that arrives after the step opened", () => {
    const step = (heightCm: number | undefined, weightKg: number | undefined) => (
      <ThemeProvider fixedPreference="dark">
        <BodyStep
          heightCm={heightCm}
          today={TODAY}
          weighInDate={undefined}
          weightKg={weightKg}
          weightUnit="kg"
          onChange={jest.fn()}
        />
      </ThemeProvider>
    );

    it("should fill the fields while nothing has been touched", async () => {
      await render(step(undefined, undefined));

      await screen.rerender(step(180, 80));

      expect(centimetres()).toHaveDisplayValue("180");
      expect(kilograms()).toHaveDisplayValue("80.0");
    });

    it("should leave the fields alone once the person has typed in one", async () => {
      const user = userEvent.setup();
      await render(step(undefined, undefined));
      await user.type(centimetres(), "1", { skipBlur: true });

      await screen.rerender(step(180, 80));

      expect(centimetres()).toHaveDisplayValue("1");
      expect(kilograms()).toHaveDisplayValue("");
    });

    it("should fill the fields in the unit that arrives while nothing has been touched", async () => {
      await render(step(undefined, undefined));

      await screen.rerender(
        <ThemeProvider fixedPreference="dark">
          <BodyStep
            heightCm={180}
            today={TODAY}
            weighInDate={undefined}
            weightKg={80}
            weightUnit="lb"
            onChange={jest.fn()}
          />
        </ThemeProvider>,
      );

      expect(feet()).toHaveDisplayValue("5");
      expect(pounds()).toHaveDisplayValue("176.4");
    });
  });

  it("should write nothing about the height or the weight to the console", async () => {
    const consoleCalls = (["log", "info", "warn", "error", "debug"] as const).map((method) =>
      jest.spyOn(console, method).mockImplementation(() => undefined),
    );
    const user = userEvent.setup();
    await renderStep();

    await user.type(centimetres(), "18");
    await user.type(kilograms(), "81.45");
    await user.press(imperialUnits());

    for (const call of consoleCalls) {
      expect(call).not.toHaveBeenCalled();
    }
  });
});
