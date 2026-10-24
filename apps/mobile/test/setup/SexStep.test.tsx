import { cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { useState } from "react";

import { SexStep } from "../../components/SetupScreen/steps/SexStep";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { Sex } from "@keylow/core/engine";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

async function renderStep(value: Sex | undefined, onChange: (sex: Sex) => void = jest.fn()) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <SexStep value={value} onChange={onChange} />
    </ThemeProvider>,
  );
}

// A screen that keeps the answer, as the wizard does.
function StepThatKeepsTheAnswer() {
  const [value, setValue] = useState<Sex | undefined>(undefined);
  return <SexStep value={value} onChange={setValue} />;
}

describe("SexStep", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/SetupScreen"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  afterEach(async () => {
    await cleanup();
  });

  it("should offer Female, Male and Prefer not to say, in that order, in a group named by the question", async () => {
    await renderStep(undefined);

    // A radio group is not itself focusable, so a role query does not reach it. It is found by its name.
    expect(screen.getByLabelText("What is your sex?")).toHaveProp("role", "radiogroup");
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(radios[0]).toHaveAccessibleName("Female");
    expect(radios[1]).toHaveAccessibleName("Male");
    expect(radios[2]).toHaveAccessibleName(
      "Prefer not to say, Ki-Lo uses the average of the female and male estimates",
    );
  });

  it("should show the description under Prefer not to say and under no other card", async () => {
    await renderStep(undefined);

    expect(
      screen.getAllByText("Ki-Lo uses the average of the female and male estimates."),
    ).toHaveLength(1);
  });

  it("should have nothing chosen when no sex is given", async () => {
    await renderStep(undefined);

    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toBeChecked();
    }
  });

  it("should show the given sex as chosen", async () => {
    await renderStep("male");

    expect(screen.getByRole("radio", { name: "Male" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Female" })).not.toBeChecked();
  });

  it("should hand on male when Male is pressed", async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    await renderStep(undefined, onChange);

    await user.press(screen.getByRole("radio", { name: "Male" }));

    expect(onChange).toHaveBeenCalledWith("male");
  });

  it("should hand on other when Prefer not to say is pressed", async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    await renderStep(undefined, onChange);

    await user.press(screen.getByRole("radio", { name: /^Prefer not to say/ }));

    expect(onChange).toHaveBeenCalledWith("other");
  });

  it("should move the choice from one card to another", async () => {
    const user = userEvent.setup();
    await render(
      <ThemeProvider fixedPreference="dark">
        <StepThatKeepsTheAnswer />
      </ThemeProvider>,
    );

    await user.press(screen.getByRole("radio", { name: "Female" }));
    await user.press(screen.getByRole("radio", { name: "Male" }));

    expect(screen.getByRole("radio", { name: "Male" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Female" })).not.toBeChecked();
  });
});
