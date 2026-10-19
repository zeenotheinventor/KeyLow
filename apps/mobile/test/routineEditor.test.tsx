import "react-native-gesture-handler/jestSetup";

import {
  ROUTINE_DAY_CONTROLS,
  ROUTINE_DISCARD,
  ROUTINE_EDITOR,
  describeDayMenuName,
} from "@keylow/core/copy";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from "@testing-library/react-native";
import { Keyboard } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { RoutineEditor } from "../components/RoutineEditor";
import { routinesPath } from "../lib/routineRoutes";
import { ThemeProvider } from "../lib/theme";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { pushPullLegsDraft } from "./support/routineEditorFixtures";

import type { RoutineDraft } from "@keylow/core/training";

// The routine editor shell with a draft handed to it: the name, the days and their weekdays, the live meta,
// and what closing does. Nothing saves, so no hook is stood in for.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

// What the navigator is told about holding the screen back, so a test can press the Android back button or
// swipe back as the navigator would.
type HoldEvent = { data: { action: { type: string } } };
const mockHold: { isHeld: boolean; onHeld: (event: HoldEvent) => void } = {
  isHeld: false,
  onHeld: () => undefined,
};
jest.mock("expo-router/react-navigation", () => ({
  usePreventRemove: (isHeld: boolean, onHeld: (event: HoldEvent) => void) => {
    mockHold.isHeld = isHeld;
    mockHold.onHeld = onHeld;
  },
}));

setUpTests();

async function showEditor(initialDraft?: RoutineDraft) {
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <RoutineEditor initialDraft={initialDraft} />
    </ThemeProvider>,
  );
  return user;
}

const nameField = () => screen.getByLabelText(ROUTINE_EDITOR.nameLabel);
const summary = (text: string) => screen.getByText(text);
function toggle(verb: "Show" | "Hide", dayName: string) {
  const [first] = screen.getAllByRole("button", { name: `${verb} ${dayName} exercises` });
  if (first === undefined) {
    throw new Error(`There is no ${verb} button for ${dayName}`);
  }
  return first;
}
const weekdayButton = (dayName: string, weekdayName: string) =>
  screen.getByRole("button", { name: `Weekday for ${dayName}: ${weekdayName}` });

describe("the routine editor", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/RoutineEditor",
      "components/RoutineDayCard",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    mockHold.isHeld = false;
  });

  afterEach(async () => {
    await cleanup();
    jest.restoreAllMocks();
  });

  describe("a saved routine", () => {
    it("should head the screen with Cancel editing, Edit routine and a Save that cannot be pressed", async () => {
      await showEditor(pushPullLegsDraft);

      expect(screen.getByRole("heading", { name: ROUTINE_EDITOR.title })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: ROUTINE_EDITOR.cancelLabel })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: ROUTINE_EDITOR.saveAction })).toBeDisabled();
    });

    it("should show its name", async () => {
      await showEditor(pushPullLegsDraft);

      expect(nameField()).toHaveDisplayValue("Push Pull Legs");
    });

    it("should show its four days, each with its weekday and its exercises and sets", async () => {
      await showEditor(pushPullLegsDraft);

      expect(screen.getAllByText("Push")).toHaveLength(2);
      expect(screen.getByText("Pull")).toBeOnTheScreen();
      expect(screen.getByText("Legs")).toBeOnTheScreen();
      expect(within(weekdayButton("Pull", "Tuesday")).getByText("Tue")).toBeOnTheScreen();
      expect(within(weekdayButton("Legs", "Thursday")).getByText("Thu")).toBeOnTheScreen();
      expect(screen.getAllByText("5 exercises · 16 sets")).toHaveLength(3);
      expect(screen.getByText("5 exercises · 15 sets")).toBeOnTheScreen();
    });

    it("should sum the days up as 4 of 7 and 63 sets a week", async () => {
      await showEditor(pushPullLegsDraft);

      expect(screen.getByRole("heading", { name: ROUTINE_EDITOR.daysHeading })).toBeOnTheScreen();
      expect(summary("4 of 7 · 63 sets a week")).toBeOnTheScreen();
    });

    it("should show a day's name field only while the day is open", async () => {
      const user = await showEditor(pushPullLegsDraft);
      expect(screen.queryByLabelText("Day name for Pull")).not.toBeOnTheScreen();

      await user.press(toggle("Show", "Pull"));

      expect(screen.getByLabelText("Day name for Pull")).toHaveDisplayValue("Pull");
      expect(toggle("Hide", "Pull")).toBeOnTheScreen();

      await user.press(toggle("Hide", "Pull"));

      expect(screen.queryByLabelText("Day name for Pull")).not.toBeOnTheScreen();
      expect(toggle("Show", "Pull")).toBeOnTheScreen();
    });

    it("should rename the routine as it is typed", async () => {
      await showEditor(pushPullLegsDraft);

      await fireEvent.changeText(nameField(), "Upper Lower");

      expect(nameField()).toHaveDisplayValue("Upper Lower");
    });

    it("should add a day that is open, named Day 5 and on any day", async () => {
      const user = await showEditor(pushPullLegsDraft);

      await user.press(screen.getByRole("button", { name: ROUTINE_DAY_CONTROLS.addDayAction }));

      expect(screen.getByText("Day 5")).toBeOnTheScreen();
      expect(screen.getByText("0 exercises · 0 sets")).toBeOnTheScreen();
      expect(within(weekdayButton("Day 5", "any day")).getByText("Any")).toBeOnTheScreen();
      expect(screen.getByLabelText("Day name for Day 5")).toHaveDisplayValue("Day 5");
      expect(summary("5 of 7 · 63 sets a week")).toBeOnTheScreen();
    });

    it("should rename a day in its header and in the names of its controls", async () => {
      const user = await showEditor(pushPullLegsDraft);
      await user.press(toggle("Show", "Pull"));

      await fireEvent.changeText(screen.getByLabelText("Day name for Pull"), "Pull B");

      expect(screen.getByText("Pull B")).toBeOnTheScreen();
      expect(screen.queryByText("Pull")).not.toBeOnTheScreen();
      expect(weekdayButton("Pull B", "Tuesday")).toBeOnTheScreen();
      expect(toggle("Hide", "Pull B")).toBeOnTheScreen();
    });

    it("should change a day's weekday from the sheet the weekday opens, and close the sheet", async () => {
      const user = await showEditor(pushPullLegsDraft);

      await user.press(weekdayButton("Pull", "Tuesday"));
      await user.press(screen.getByRole("radio", { name: "Wed" }));

      expect(within(weekdayButton("Pull", "Wednesday")).getByText("Wed")).toBeOnTheScreen();
      // The sheet slides away, so it is gone a moment after the choice.
      await waitFor(() => {
        expect(screen.queryByRole("radio", { name: "Wed" })).not.toBeOnTheScreen();
      });
    });

    it("should offer Monday to Sunday and any day, with the day's own weekday chosen", async () => {
      const user = await showEditor(pushPullLegsDraft);

      await user.press(weekdayButton("Legs", "Thursday"));

      const chips = screen.getAllByRole("radio");
      expect(chips).toHaveLength(8);
      ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Any"].forEach((name, position) => {
        expect(chips[position]).toHaveAccessibleName(name);
      });
      expect(screen.getByRole("radio", { name: "Thu" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "Mon" })).not.toBeChecked();
    });

    it("should close the sheet when the weekday the day is on is pressed again, changing nothing", async () => {
      const user = await showEditor(pushPullLegsDraft);
      await user.press(weekdayButton("Pull", "Tuesday"));

      await user.press(screen.getByRole("radio", { name: "Tue" }));

      expect(weekdayButton("Pull", "Tuesday")).toBeOnTheScreen();
      expect(mockHold.isHeld).toBe(false);
      await waitFor(() => {
        expect(screen.queryByRole("radio", { name: "Tue" })).not.toBeOnTheScreen();
      });
    });

    it("should keep the sheet's title while it slides away", async () => {
      const user = await showEditor(pushPullLegsDraft);
      await user.press(weekdayButton("Pull", "Tuesday"));

      await user.press(screen.getByRole("radio", { name: "Wed" }));

      expect(screen.getByRole("heading", { name: "Weekday for Pull" })).toBeOnTheScreen();
    });

    it("should put the keyboard away when the weekday sheet or a day's menu opens", async () => {
      const dismiss = jest.spyOn(Keyboard, "dismiss").mockImplementation(() => undefined);
      const user = await showEditor(pushPullLegsDraft);
      await user.press(toggle("Show", "Pull"));
      expect(dismiss).not.toHaveBeenCalled();

      await user.press(weekdayButton("Pull", "Tuesday"));
      expect(dismiss).toHaveBeenCalledTimes(1);
      await user.press(screen.getByRole("radio", { name: "Tue" }));
      await user.press(screen.getByRole("button", { name: describeDayMenuName("Pull") }));

      expect(dismiss).toHaveBeenCalledTimes(2);
    });

    it("should let a day go back to any day", async () => {
      const user = await showEditor(pushPullLegsDraft);

      await user.press(weekdayButton("Pull", "Tuesday"));
      await user.press(screen.getByRole("radio", { name: "Any" }));

      expect(weekdayButton("Pull", "any day")).toBeOnTheScreen();
    });

    it("should remove a day from its menu and sum the rest up", async () => {
      const user = await showEditor(pushPullLegsDraft);
      await user.press(toggle("Show", "Pull"));

      await user.press(screen.getByRole("button", { name: describeDayMenuName("Pull") }));
      await user.press(screen.getByRole("button", { name: ROUTINE_DAY_CONTROLS.removeDayAction }));

      expect(screen.queryByText("Pull")).not.toBeOnTheScreen();
      expect(summary("3 of 7 · 48 sets a week")).toBeOnTheScreen();
    });
  });

  describe("a new routine", () => {
    it("should be titled New routine, with an empty name and no days", async () => {
      await showEditor();

      expect(screen.getByRole("heading", { name: ROUTINE_EDITOR.newTitle })).toBeOnTheScreen();
      expect(nameField()).toHaveDisplayValue("");
      expect(summary("0 of 7 · 0 sets a week")).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /exercises$/ })).not.toBeOnTheScreen();
    });

    it("should stop offering Add day at seven days", async () => {
      const user = await showEditor();
      const addDay = () => screen.getByRole("button", { name: ROUTINE_DAY_CONTROLS.addDayAction });

      for (let added = 0; added < 7; added += 1) {
        expect(addDay()).toBeEnabled();
        await user.press(addDay());
      }

      expect(addDay()).toBeDisabled();
      expect(summary("7 of 7 · 0 sets a week")).toBeOnTheScreen();
    });
  });

  describe("closing", () => {
    it("should go back without asking when nothing changed", async () => {
      const user = await showEditor(pushPullLegsDraft);

      await user.press(screen.getByRole("button", { name: ROUTINE_EDITOR.cancelLabel }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("heading", { name: ROUTINE_DISCARD.title })).not.toBeOnTheScreen();
      expect(mockHold.isHeld).toBe(false);
    });

    it("should ask first when the name changed", async () => {
      const user = await showEditor(pushPullLegsDraft);
      await fireEvent.changeText(nameField(), "Upper Lower");

      await user.press(screen.getByRole("button", { name: ROUTINE_EDITOR.cancelLabel }));

      expect(screen.getByRole("heading", { name: ROUTINE_DISCARD.title })).toBeOnTheScreen();
      expect(routerMock.back).not.toHaveBeenCalled();
    });

    it("should ask first when a day was added to a new routine", async () => {
      const user = await showEditor();
      await user.press(screen.getByRole("button", { name: ROUTINE_DAY_CONTROLS.addDayAction }));

      await user.press(screen.getByRole("button", { name: ROUTINE_EDITOR.cancelLabel }));

      expect(screen.getByRole("heading", { name: ROUTINE_DISCARD.title })).toBeOnTheScreen();
    });

    it("should not ask when a change was put back as it was", async () => {
      const user = await showEditor(pushPullLegsDraft);
      await fireEvent.changeText(nameField(), "Upper Lower");
      await fireEvent.changeText(nameField(), "Push Pull Legs");

      await user.press(screen.getByRole("button", { name: ROUTINE_EDITOR.cancelLabel }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("heading", { name: ROUTINE_DISCARD.title })).not.toBeOnTheScreen();
    });

    it("should ask first when only a day's weekday changed", async () => {
      const user = await showEditor(pushPullLegsDraft);
      await user.press(weekdayButton("Pull", "Tuesday"));
      await user.press(screen.getByRole("radio", { name: "Wed" }));

      await user.press(screen.getByRole("button", { name: ROUTINE_EDITOR.cancelLabel }));

      expect(screen.getByRole("heading", { name: ROUTINE_DISCARD.title })).toBeOnTheScreen();
      expect(routerMock.back).not.toHaveBeenCalled();
    });

    it("should ask first when only a day was renamed", async () => {
      const user = await showEditor(pushPullLegsDraft);
      await user.press(toggle("Show", "Pull"));
      await fireEvent.changeText(screen.getByLabelText("Day name for Pull"), "Pull B");

      await user.press(screen.getByRole("button", { name: ROUTINE_EDITOR.cancelLabel }));

      expect(screen.getByRole("heading", { name: ROUTINE_DISCARD.title })).toBeOnTheScreen();
      expect(routerMock.back).not.toHaveBeenCalled();
    });

    it("should ask first when a day was removed and another added, leaving as many days", async () => {
      const user = await showEditor(pushPullLegsDraft);
      await user.press(toggle("Show", "Pull"));
      await user.press(screen.getByRole("button", { name: describeDayMenuName("Pull") }));
      await user.press(screen.getByRole("button", { name: ROUTINE_DAY_CONTROLS.removeDayAction }));
      await user.press(screen.getByRole("button", { name: ROUTINE_DAY_CONTROLS.addDayAction }));
      expect(summary("4 of 7 · 48 sets a week")).toBeOnTheScreen();

      await user.press(screen.getByRole("button", { name: ROUTINE_EDITOR.cancelLabel }));

      expect(screen.getByRole("heading", { name: ROUTINE_DISCARD.title })).toBeOnTheScreen();
      expect(routerMock.back).not.toHaveBeenCalled();
    });

    it("should not count opening a day as a change", async () => {
      const user = await showEditor(pushPullLegsDraft);
      await user.press(toggle("Show", "Pull"));

      expect(mockHold.isHeld).toBe(false);
    });

    it("should stay when Keep editing is pressed, with the changes kept", async () => {
      const user = await showEditor(pushPullLegsDraft);
      await fireEvent.changeText(nameField(), "Upper Lower");
      await user.press(screen.getByRole("button", { name: ROUTINE_EDITOR.cancelLabel }));

      await user.press(screen.getByRole("button", { name: ROUTINE_DISCARD.keepEditingAction }));

      expect(screen.queryByRole("heading", { name: ROUTINE_DISCARD.title })).not.toBeOnTheScreen();
      expect(routerMock.back).not.toHaveBeenCalled();
      expect(nameField()).toHaveDisplayValue("Upper Lower");
    });

    it("should go back once the changes are discarded", async () => {
      const user = await showEditor(pushPullLegsDraft);
      await fireEvent.changeText(nameField(), "Upper Lower");
      await user.press(screen.getByRole("button", { name: ROUTINE_EDITOR.cancelLabel }));

      await user.press(screen.getByRole("button", { name: ROUTINE_DISCARD.discardAction }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should hold the Android back button and the swipe back when changed, and ask the same question", async () => {
      await showEditor(pushPullLegsDraft);
      await fireEvent.changeText(nameField(), "Upper Lower");
      expect(mockHold.isHeld).toBe(true);

      await act(() => {
        mockHold.onHeld({ data: { action: { type: "GO_BACK" } } });
      });

      expect(screen.getByRole("heading", { name: ROUTINE_DISCARD.title })).toBeOnTheScreen();
    });

    it("should go to the routines list when nothing is before the editor", async () => {
      routerMock.canGoBack.mockReturnValue(false);
      const user = await showEditor(pushPullLegsDraft);

      await user.press(screen.getByRole("button", { name: ROUTINE_EDITOR.cancelLabel }));

      expect(routerMock.replace).toHaveBeenCalledWith(routinesPath());
      expect(routerMock.back).not.toHaveBeenCalled();
    });
  });
});
