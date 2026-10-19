import { render, screen, userEvent } from "@testing-library/react-native";
import { impactAsync } from "expo-haptics";
import { setUpTests } from "react-native-reanimated";

import { ChipGroup } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { viewsDrawn } from "../support/viewsDrawn";

import type { ChipGroupProps } from "../../components/ui";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const mockImpact = jest.mocked(impactAsync);

const effortOptions = ["0", "1", "2", "3", "4", "5", "6+"].map((label, index) => ({
  value: String(index),
  label,
}));

function renderGroup(props: Partial<ChipGroupProps<string>> = {}) {
  return render(
    <ThemeProvider fixedPreference="dark">
      <ChipGroup
        label="RIR"
        layout="equal"
        options={effortOptions}
        value="1"
        onChange={() => undefined}
        {...props}
      />
    </ThemeProvider>,
  );
}

describe("ChipGroup in equal columns", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    mockImpact.mockClear();
  });

  it("should still be a radio group of one radio for each option, named by the option", async () => {
    await renderGroup();

    expect(screen.getByLabelText("RIR")).toHaveProp("role", "radiogroup");
    expect(screen.getAllByRole("radio")).toHaveLength(7);
    expect(screen.getByRole("radio", { name: "6+" })).toBeOnTheScreen();
  });

  it("should give every chip an equal share of the line and the 44 point touch height, 6 points apart", async () => {
    await renderGroup();

    expect(screen.getByLabelText("RIR")).toHaveStyle({ flexDirection: "row", columnGap: 6 });
    for (const chip of screen.getAllByRole("radio")) {
      expect(chip).toHaveStyle({ height: 44 });
    }
    expect(viewsDrawn({ flexGrow: 1, flexBasis: 0 })).toHaveLength(7);
  });

  it("should choose the chip pressed", async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    await renderGroup({ onChange });

    await user.press(screen.getByRole("radio", { name: "3" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("3");
  });
});

describe("ChipGroup that can be cleared", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    mockImpact.mockClear();
  });

  it("should clear the choice when the chosen chip is pressed again", async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    await render(
      <ThemeProvider fixedPreference="dark">
        <ChipGroup
          allowDeselect
          label="RIR"
          options={effortOptions}
          value="1"
          onChange={onChange}
        />
      </ThemeProvider>,
    );

    await user.press(screen.getByRole("radio", { name: "1" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(null);
    expect(mockImpact).toHaveBeenCalledTimes(1);
  });

  it("should still choose another chip with its value", async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    await render(
      <ThemeProvider fixedPreference="dark">
        <ChipGroup
          allowDeselect
          label="RIR"
          options={effortOptions}
          value="1"
          onChange={onChange}
        />
      </ThemeProvider>,
    );

    await user.press(screen.getByRole("radio", { name: "4" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("4");
  });

  it("should leave the chosen chip alone when it cannot be cleared", async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    await renderGroup({ onChange });

    await user.press(screen.getByRole("radio", { name: "1" }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
