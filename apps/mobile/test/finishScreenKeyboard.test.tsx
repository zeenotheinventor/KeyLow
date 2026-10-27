import { KeyLowProvider } from "@keylow/api-client";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from "@testing-library/react-native";
import { useState } from "react";
import { Platform } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { FinishScreen } from "../components/FinishScreen";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { finishClient, finishWrites, resetFinishWrites } from "./support/finishBackend";
import {
  focusFieldAt,
  holdFrames,
  scrollViewOnScreen,
  stubScrollViewAt,
} from "./support/focusedField";
import { stubKeyboard } from "./support/keyboardStub";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { GOLDEN_SESSION_ID, goldenLegsOpen, LEGS_DAY_ID } from "./support/sessionGoldenLegs";
import { resetTrainBackend, trainBackend } from "./support/trainBackend";
import { viewsDrawn } from "./support/viewsDrawn";

import type { FinishDetails } from "../components/FinishScreen";
import type { QueryClient } from "@tanstack/react-query";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

// The finish screen's note above the keyboard. The note sits low in a long screen, so on Android, which
// does not resize the window for the keyboard, the screen lifts for it and scrolls the note into view. iOS
// adjusts the scroll view itself.

setUpTests();

const details: FinishDetails = {
  sessionId: GOLDEN_SESSION_ID,
  dayName: "Lower body",
  startedAt: "2026-10-15T17:30:00Z",
  workingSets: 9,
  plannedSets: 9,
  warmups: 0,
  exercisesLogged: 3,
  exercisesPlanned: 3,
  notLoggedNote: null,
  sets: [],
};

let queryClient: QueryClient;

function FinishScreenWithNote() {
  const [note, setNote] = useState("");
  return (
    <FinishScreen
      details={details}
      note={note}
      onChangeNote={setNote}
      onKeepLogging={jest.fn()}
      onSaved={jest.fn()}
    />
  );
}

async function renderFinishScreen() {
  queryClient = createDiaryQueryClient();
  return render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={finishClient} queryClient={queryClient}>
        <FinishScreenWithNote />
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

// The bottom padding that lifts the screen, which the closed keyboard leaves at 0.
const liftedBy = (paddingBottom: number) => viewsDrawn({ paddingBottom });

describe("the finish screen above the keyboard", () => {
  let styles: string;

  beforeAll(async () => {
    styles = await compileKitStyles("", [
      "components/FinishScreen",
      "components/MusclesTrainedCard",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(styles);
    resetTrainBackend();
    resetFinishWrites();
    trainBackend.activeSession = goldenLegsOpen(LEGS_DAY_ID, [], "legs");
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
    queryClient.clear();
  });

  describe("on Android", () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, "OS", "android");
    });

    it("should not lift the screen while the keyboard is closed", async () => {
      stubKeyboard(800);
      await renderFinishScreen();

      expect(liftedBy(240)).toHaveLength(0);
    });

    it("should lift the screen by the height of the keyboard that covers its bottom", async () => {
      const keyboard = stubKeyboard(800);
      await renderFinishScreen();

      await keyboard.show(560);

      expect(liftedBy(240)).toHaveLength(1);
    });

    it("should lift the screen by no more than the keyboard's height when the keyboard announces its top at 0", async () => {
      const keyboard = stubKeyboard(800);
      await renderFinishScreen();

      await keyboard.show(0);

      // The keyboard is 300 tall, so the screen is lifted 300 and not the 800 that would leave it no height.
      expect(liftedBy(300)).toHaveLength(1);
      expect(liftedBy(800)).toHaveLength(0);
    });

    it("should scroll the focused note far enough to clear its counter, from where the screen is scrolled to", async () => {
      // The scroll view ends at 700, and the note ends at 750, so 50 are hidden. The counter ends 31 below
      // the note, so the room to spare is that and the usual 16.
      const keyboard = stubKeyboard(800);
      focusFieldAt(650, 100);
      const frames = holdFrames();
      const scrollTo = stubScrollViewAt(100, 600);
      await renderFinishScreen();
      await fireEvent.scroll(scrollViewOnScreen(), {
        nativeEvent: { contentOffset: { y: 200 } },
      });

      await keyboard.show(560);
      await frames.run();

      expect(scrollTo).toHaveBeenCalledWith({ y: 200 + 50 + 31 + 16, animated: false });
    });

    it("should lower the screen when the keyboard goes", async () => {
      const keyboard = stubKeyboard(800);
      await renderFinishScreen();
      await keyboard.show(560);
      expect(liftedBy(240)).toHaveLength(1);

      await keyboard.hide();

      expect(liftedBy(240)).toHaveLength(0);
    });

    it("should keep Save session on the screen and pressable with the keyboard open, saving the typed note", async () => {
      const keyboard = stubKeyboard(800);
      const user = userEvent.setup();
      await renderFinishScreen();
      await user.type(screen.getByLabelText("Note, optional"), "Sore calves");
      await keyboard.show(560);

      await user.press(screen.getByRole("button", { name: "Save session" }));

      await waitFor(() => {
        expect(finishWrites.patched).toHaveLength(1);
      });
      expect(finishWrites.patched[0]).toMatchObject({ note: "Sore calves" });
    });
  });

  describe("on iOS", () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, "OS", "ios");
    });

    it("should leave the screen where it is when the keyboard shows, as the scroll view adjusts itself", async () => {
      const keyboard = stubKeyboard(800);
      await renderFinishScreen();

      await keyboard.show(560);

      expect(liftedBy(240)).toHaveLength(0);
      expect(scrollViewOnScreen()).toHaveProp("automaticallyAdjustKeyboardInsets", true);
    });
  });
});
