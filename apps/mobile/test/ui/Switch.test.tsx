import { render, screen, userEvent } from "@testing-library/react-native";
import { impactAsync } from "expo-haptics";
import { useState } from "react";
import { setUpTests } from "react-native-reanimated";

import { Switch } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";
import { viewsDrawn } from "../support/viewsDrawn";

import type { SwitchProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const mockImpact = jest.mocked(impactAsync);

function renderSwitch(props: Partial<SwitchProps> = {}, scheme: ThemeScheme = "dark") {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <Switch isOn={false} label="Default portion" onValueChange={() => undefined} {...props} />
    </ThemeProvider>,
  );
}

// A screen that keeps the choice, as the food form does for each portion.
function PortionDefault() {
  const [isOn, setIsOn] = useState(false);
  return (
    <ThemeProvider fixedPreference="dark">
      <Switch isOn={isOn} label="Default portion" onValueChange={setIsOn} />
    </ThemeProvider>
  );
}

const schemes: ThemeScheme[] = ["dark", "light"];

describe("Switch", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    mockImpact.mockClear();
  });

  describe("what it says", () => {
    it("should be a switch named by its label", async () => {
      await renderSwitch();

      expect(screen.getByRole("switch", { name: "Default portion" })).toBeOnTheScreen();
    });

    it("should say it is on when it is", async () => {
      await renderSwitch({ isOn: true });

      expect(screen.getByRole("switch", { name: "Default portion" })).toBeChecked();
    });

    it("should say it is off when it is", async () => {
      await renderSwitch({ isOn: false });

      expect(screen.getByRole("switch", { name: "Default portion" })).not.toBeChecked();
    });

    it("should reach the 44 point touch target past its 26 point height", async () => {
      await renderSwitch();

      expect(screen.getByRole("switch", { name: "Default portion" })).toHaveProp("hitSlop", {
        top: 9,
        bottom: 9,
      });
    });
  });

  describe("switching", () => {
    it("should hand on the opposite of what it shows when pressed", async () => {
      const user = userEvent.setup();
      const onValueChange = jest.fn();
      await renderSwitch({ isOn: false, onValueChange });

      await user.press(screen.getByRole("switch", { name: "Default portion" }));

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenCalledWith(true);
    });

    it("should hand on off when pressed while it is on", async () => {
      const user = userEvent.setup();
      const onValueChange = jest.fn();
      await renderSwitch({ isOn: true, onValueChange });

      await user.press(screen.getByRole("switch", { name: "Default portion" }));

      expect(onValueChange).toHaveBeenCalledWith(false);
    });

    it("should play the selection haptic", async () => {
      const user = userEvent.setup();
      await renderSwitch();

      await user.press(screen.getByRole("switch", { name: "Default portion" }));

      expect(mockImpact).toHaveBeenCalledTimes(1);
      expect(mockImpact).toHaveBeenCalledWith("light");
    });

    it("should change at once when a screen keeps the choice", async () => {
      const user = userEvent.setup();
      await render(<PortionDefault />);

      await user.press(screen.getByRole("switch", { name: "Default portion" }));

      expect(screen.getByRole("switch", { name: "Default portion" })).toBeChecked();
    });
  });

  describe.each(schemes)("in the %s scheme", (scheme) => {
    const colorOf = (name: Parameters<typeof resolvedColor>[1]) => resolvedColor(scheme, name);

    it("should draw an off switch as a 44 by 26 pill in the strong border colour, with a primary knob at the left", async () => {
      await renderSwitch({ isOn: false }, scheme);
      await screen.findByRole("switch", { name: "Default portion" });

      expect(
        viewsDrawn({
          width: 44,
          height: 26,
          borderRadius: 999,
          backgroundColor: colorOf("border-strong"),
        }),
      ).toHaveLength(1);
      expect(
        viewsDrawn({
          width: 20,
          height: 20,
          borderRadius: 999,
          backgroundColor: colorOf("text-primary"),
          position: "absolute",
          top: 3,
          left: 3,
        }),
      ).toHaveLength(1);
    });

    it("should draw an on switch as an accent pill with an accent foreground knob at the right", async () => {
      await renderSwitch({ isOn: true }, scheme);
      await screen.findByRole("switch", { name: "Default portion" });

      expect(
        viewsDrawn({
          width: 44,
          height: 26,
          borderRadius: 999,
          backgroundColor: colorOf("accent"),
        }),
      ).toHaveLength(1);
      expect(
        viewsDrawn({
          width: 20,
          height: 20,
          backgroundColor: colorOf("accent-foreground"),
          position: "absolute",
          top: 3,
          left: 21,
        }),
      ).toHaveLength(1);
    });
  });
});
