import { render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { RecipeStepsSection } from "../../components/RecipeStepsSection";
import { ToastProvider } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { ReactElement } from "react";

// What the section does on its own when the steps it is given change under Reorder.

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

const nothing = () => undefined;

function section(steps: string[]): ReactElement {
  return (
    <ThemeProvider fixedPreference="dark">
      <ToastProvider>
        <RecipeStepsSection
          headingRef={null}
          isLocked={false}
          steps={steps}
          onAdd={nothing}
          onMoveDown={nothing}
          onMoveUp={nothing}
          onOpen={nothing}
        />
      </ToastProvider>
    </ThemeProvider>
  );
}

describe("RecipeStepsSection", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/RecipeStepsSection", "components/StepRow"]);
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("should not come back in Reorder when the steps fall below two and rise to two again", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const view = await render(section(["Rinse.", "Chop."]));
    await user.press(screen.getByRole("button", { name: "Reorder" }));
    expect(screen.getByRole("button", { name: "Done" })).toBeOnTheScreen();

    await view.rerender(section(["Rinse."]));
    await view.rerender(section(["Rinse.", "Chop."]));

    expect(screen.getByRole("button", { name: "Reorder" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Add step" })).toBeOnTheScreen();
  });
});
