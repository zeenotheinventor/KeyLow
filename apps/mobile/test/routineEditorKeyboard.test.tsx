import "react-native-gesture-handler/jestSetup";

import { fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { Platform } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { RoutineEditor } from "../components/RoutineEditor";
import { ThemeProvider } from "../lib/theme";
import { EditorProviders } from "./support/editorProviders";
import { resetRouterMock } from "./support/expoRouterMock";
import {
  focusFieldAt,
  holdFrames,
  scrollViewOnScreen,
  stubScrollViewAt,
} from "./support/focusedField";
import { stubKeyboard } from "./support/keyboardStub";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { pushPullLegsDraft } from "./support/routineEditorFixtures";
import { pushPullLegsExerciseNames } from "./support/routineExerciseFixtures";
import { viewsDrawn } from "./support/viewsDrawn";

// The routine editor's fields above the keyboard. An exercise's fields sit low in a long screen, so on
// Android, which does not resize the window for the keyboard, the screen lifts for it and scrolls the field
// that has focus into view. iOS adjusts the scroll view itself.

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
jest.mock("expo-router/react-navigation", () => ({ usePreventRemove: () => undefined }));

setUpTests();

async function showEditorWithLegsOpen() {
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <EditorProviders>
        <RoutineEditor exerciseNames={pushPullLegsExerciseNames} initialDraft={pushPullLegsDraft} />
      </EditorProviders>
    </ThemeProvider>,
  );
  await user.press(screen.getByRole("button", { name: "Show Legs exercises" }));
}

describe("the routine editor above the keyboard", () => {
  let styles: string;

  beforeAll(async () => {
    styles = await compileKitStyles("", [
      "components/RoutineEditor",
      "components/RoutineDayCard",
      "components/RoutineDayExercises",
      "components/RoutineExerciseRow",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(styles);
    resetRouterMock();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("on Android", () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, "OS", "android");
    });

    it("should lift the screen by the height of the keyboard that covers its bottom", async () => {
      const keyboard = stubKeyboard(800);
      await showEditorWithLegsOpen();
      expect(viewsDrawn({ paddingBottom: 240 })).toHaveLength(0);

      await keyboard.show(560);

      expect(viewsDrawn({ paddingBottom: 240 })).toHaveLength(1);
    });

    it("should lower the screen when the keyboard goes", async () => {
      const keyboard = stubKeyboard(800);
      await showEditorWithLegsOpen();
      await keyboard.show(560);

      await keyboard.hide();

      expect(viewsDrawn({ paddingBottom: 240 })).toHaveLength(0);
    });

    it("should scroll the focused field clear of the keyboard, from where the screen is scrolled to", async () => {
      // The scroll view ends at 700, and the field ends at 750, so 50 and the room to spare are hidden.
      const keyboard = stubKeyboard(800);
      focusFieldAt(714, 36);
      const frames = holdFrames();
      const scrollTo = stubScrollViewAt(100, 600);
      await showEditorWithLegsOpen();
      await fireEvent.scroll(scrollViewOnScreen(), {
        nativeEvent: { contentOffset: { y: 200 } },
      });

      await keyboard.show(560);
      await frames.run();

      expect(scrollTo).toHaveBeenCalledWith({ y: 200 + 50 + 16, animated: false });
    });
  });

  describe("on iOS", () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, "OS", "ios");
    });

    it("should leave the screen where it is when the keyboard shows, as the scroll view adjusts itself", async () => {
      const keyboard = stubKeyboard(800);
      await showEditorWithLegsOpen();

      await keyboard.show(560);

      expect(viewsDrawn({ paddingBottom: 240 })).toHaveLength(0);
      expect(scrollViewOnScreen()).toHaveProp("automaticallyAdjustKeyboardInsets", true);
    });
  });
});
