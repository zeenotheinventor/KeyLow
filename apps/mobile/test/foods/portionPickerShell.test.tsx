import "react-native-gesture-handler/jestSetup";

import { render, screen, userEvent, within } from "@testing-library/react-native";
import { Platform, Text } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { PortionPickerShell } from "../../components/PortionPicker/PortionPickerShell";
import { ThemeProvider } from "../../lib/theme";
import { stubKeyboard } from "../support/keyboardStub";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { viewsDrawn } from "../support/viewsDrawn";

import type { PortionPickerShellProps } from "../../components/PortionPicker/PortionPickerShell";

// The page both amount pickers (a food's and a recipe's) are drawn in: the title under Back, what scrolls,
// and the dock with the Time row and the buttons. These tests pin once what both pickers rely on.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

setUpTests();

async function renderShell(props: Partial<PortionPickerShellProps> = {}) {
  const onBack = jest.fn();
  const onSubmit = jest.fn();
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <PortionPickerShell
        controls={<Text>The amount controls</Text>}
        isNow={false}
        renderActions={(chosen) => (
          <Text
            accessibilityRole="button"
            onPress={() => {
              onSubmit(chosen);
            }}
          >
            Add
          </Text>
        )}
        showsTime
        time="18:00"
        title="Chicken and rice"
        onBack={onBack}
        {...props}
      >
        <Text>What scrolls</Text>
      </PortionPickerShell>
    </ThemeProvider>,
  );
  return { user, onBack, onSubmit };
}

async function chooseTime(user: ReturnType<typeof userEvent.setup>, hour: string, minute: string) {
  await user.press(
    within(screen.getByRole("spinbutton", { name: "Hours" })).getByRole("option", { name: hour }),
  );
  await user.press(
    within(screen.getByRole("spinbutton", { name: "Minutes" })).getByRole("option", {
      name: minute,
    }),
  );
  await user.press(screen.getByRole("button", { name: "Done" }));
}

describe("PortionPickerShell", () => {
  let styles: string;

  beforeAll(async () => {
    styles = await compileKitStyles("", ["components/PortionPicker"]);
  });

  beforeEach(() => {
    registerAppStyles(styles);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should be headed by the title, with Back", async () => {
    const { user, onBack } = await renderShell();

    expect(screen.getByRole("heading", { name: "Chicken and rice" })).toBeOnTheScreen();
    await user.press(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("should draw what scrolls, the amount controls and the buttons", async () => {
    await renderShell();

    expect(screen.getByText("What scrolls")).toBeOnTheScreen();
    expect(screen.getByText("The amount controls")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Add" })).toBeOnTheScreen();
  });

  describe("the Time row", () => {
    it("should show the time it starts with", async () => {
      await renderShell();

      expect(screen.getByRole("button", { name: "Time, 18:00, change" })).toBeOnTheScreen();
    });

    it("should read Now until the time is changed, and hand that over", async () => {
      const { user, onSubmit } = await renderShell({ isNow: true, time: "12:40" });

      expect(screen.getByRole("button", { name: "Time, now, 12:40, change" })).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Add" }));

      expect(onSubmit).toHaveBeenCalledWith({ time: "12:40", isNow: true });
    });

    it("should hand over the chosen time, which is no longer Now", async () => {
      const { user, onSubmit } = await renderShell({ isNow: true, time: "12:40" });

      await user.press(screen.getByRole("button", { name: "Time, now, 12:40, change" }));
      await chooseTime(user, "17", "25");

      expect(screen.getByRole("button", { name: "Time, 17:25, change" })).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Add" }));
      expect(onSubmit).toHaveBeenCalledWith({ time: "17:25", isNow: false });
    });

    it("should be left out of a page that logs no time", async () => {
      await renderShell({ showsTime: false });

      expect(screen.queryByRole("button", { name: /^Time,/ })).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Add" })).toBeOnTheScreen();
    });
  });

  describe("above the keyboard on Android", () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, "OS", "android");
    });

    it("should leave no room under the page while the keyboard is closed", async () => {
      stubKeyboard(800);
      await renderShell();

      expect(viewsDrawn({ flexGrow: 1, paddingBottom: 240 })).toHaveLength(0);
    });

    it("should lift the page, and the buttons with it, by the height of the keyboard that covers it", async () => {
      const keyboard = stubKeyboard(800);
      await renderShell();

      await keyboard.show(560);

      expect(viewsDrawn({ flexGrow: 1, paddingBottom: 240 })).toHaveLength(1);
    });

    it("should lower the page when the keyboard goes", async () => {
      const keyboard = stubKeyboard(800);
      await renderShell();
      await keyboard.show(560);

      await keyboard.hide();

      expect(viewsDrawn({ flexGrow: 1, paddingBottom: 240 })).toHaveLength(0);
    });
  });
});
