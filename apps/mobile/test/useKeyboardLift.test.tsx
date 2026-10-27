import { captureMessage } from "@sentry/react-native";
import { act, render, screen } from "@testing-library/react-native";
import { useRef } from "react";
import { AppState, Dimensions, Keyboard, Platform, Text, View } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

import { resetKeyboardLiftReportForTests } from "../lib/sentry/reportKeyboardLiftOutOfRange";
import { recordRoute } from "../lib/sentry/trail";
import { useKeyboardLift } from "../lib/useKeyboardLift";
import { stubKeyboard, subscription } from "./support/keyboardStub";

import type { AppStateStatus } from "react-native";

// A view at the bottom of the window, 64 points tall and ending at 800, that shows how far it is lifted.
function LiftedViewInside() {
  const viewRef = useRef<View>(null);
  const lift = useKeyboardLift(viewRef);
  return (
    <View ref={viewRef}>
      <Text>{`Lift ${lift}`}</Text>
    </View>
  );
}

// The navigation bar's height under the view is the bottom inset, 0 unless a test gives one.
function LiftedView({ navigationBarInset = 0 }: { navigationBarInset?: number }) {
  return (
    <SafeAreaInsetsContext.Provider
      value={{ top: 0, left: 0, right: 0, bottom: navigationBarInset }}
    >
      <LiftedViewInside />
    </SafeAreaInsetsContext.Provider>
  );
}

// The window the view is in is 800 points tall, so a lift is held to 480 of them.
const WINDOW_HEIGHT = 800;

function stubWindow() {
  jest
    .spyOn(Dimensions, "get")
    .mockReturnValue({ width: 390, height: WINDOW_HEIGHT, scale: 1, fontScale: 1 });
}

// Stands in for the app coming forward and going away, which a test announces.
function stubAppState() {
  let listener: ((state: AppStateStatus) => void) | undefined;
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler) => {
    listener = handler;
    return subscription(() => undefined);
  });
  return {
    become: (state: AppStateStatus) =>
      act(() => {
        listener?.(state);
      }),
  };
}

describe("useKeyboardLift", () => {
  beforeEach(() => {
    resetKeyboardLiftReportForTests();
    jest.mocked(captureMessage).mockClear();
    // Jest stands the property in with a function, and the app is in front while the tests run.
    Reflect.set(AppState, "currentState", "active");
    stubWindow();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("on Android", () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, "OS", "android");
    });

    it("should lift the view by the part of it the keyboard covers, and lower it when the keyboard goes", async () => {
      const keyboard = stubKeyboard(800);
      await render(<LiftedView />);

      await keyboard.show(560);
      expect(screen.getByText("Lift 240")).toBeOnTheScreen();

      await keyboard.hide();
      expect(screen.getByText("Lift 0")).toBeOnTheScreen();
    });

    it("should lift by the whole of what the keyboard covers, the navigation bar's height with the keyboard's", async () => {
      const keyboard = stubKeyboard(800);
      await render(<LiftedView navigationBarInset={48} />);

      // The keyboard is 300 tall and its top is at 452, so the view is covered 348: the keyboard's 300 and the bar's 48.
      await keyboard.show(452);

      expect(screen.getByText("Lift 348")).toBeOnTheScreen();
    });

    it("should lift by no more than the height of the keyboard and the navigation bar, when it announces its top edge at 0", async () => {
      const keyboard = stubKeyboard(800);
      await render(<LiftedView navigationBarInset={48} />);

      await keyboard.show(0);

      expect(screen.getByText("Lift 348")).toBeOnTheScreen();
    });

    it("should lift by no more than the height of the keyboard, when it announces its top edge at 0", async () => {
      const keyboard = stubKeyboard(800);
      await render(<LiftedView />);

      await keyboard.show(0);

      expect(screen.getByText("Lift 300")).toBeOnTheScreen();
    });

    it("should lift by no more than 60% of the window, when the keyboard is announced taller than the window", async () => {
      const keyboard = stubKeyboard(800);
      await render(<LiftedView />);

      await keyboard.show(-4000, 5000);

      expect(screen.getByText("Lift 480")).toBeOnTheScreen();
    });

    it("should not lift when the keyboard announces an edge that is not a number", async () => {
      const keyboard = stubKeyboard(800);
      await render(<LiftedView />);

      await keyboard.show(Number.NaN);

      expect(screen.getByText("Lift 0")).toBeOnTheScreen();
    });

    it("should lower the view when the app goes to the background with the keyboard up", async () => {
      const keyboard = stubKeyboard(800);
      const appState = stubAppState();
      await render(<LiftedView />);
      await keyboard.show(560);

      await appState.become("background");

      expect(screen.getByText("Lift 0")).toBeOnTheScreen();
    });

    it("should lift again on return for a keyboard that is still up and was not announced again", async () => {
      const keyboard = stubKeyboard(800);
      const appState = stubAppState();
      await render(<LiftedView />);
      await keyboard.show(560);
      await appState.become("background");
      jest.spyOn(Keyboard, "isVisible").mockReturnValue(true);
      jest
        .spyOn(Keyboard, "metrics")
        .mockReturnValue({ screenX: 0, screenY: 560, width: 390, height: 300 });

      await appState.become("active");

      expect(screen.getByText("Lift 240")).toBeOnTheScreen();
    });

    it("should keep the view down on return when the keyboard is not up", async () => {
      const keyboard = stubKeyboard(800);
      const appState = stubAppState();
      await render(<LiftedView />);
      await keyboard.show(560);
      await appState.become("background");
      jest.spyOn(Keyboard, "isVisible").mockReturnValue(false);

      await appState.become("active");

      expect(screen.getByText("Lift 0")).toBeOnTheScreen();
    });

    it("should hold the view to the keyboard's height on return when its last announcement was bad", async () => {
      const keyboard = stubKeyboard(800);
      const appState = stubAppState();
      await render(<LiftedView />);
      await keyboard.show(560);
      await appState.become("background");
      jest.spyOn(Keyboard, "isVisible").mockReturnValue(true);
      jest
        .spyOn(Keyboard, "metrics")
        .mockReturnValue({ screenX: 0, screenY: 0, width: 390, height: 300 });

      await appState.become("active");

      expect(screen.getByText("Lift 300")).toBeOnTheScreen();
    });

    describe("the report to Sentry", () => {
      it("should send one message for a lift out of range, with where it was and what the keyboard announced", async () => {
        const keyboard = stubKeyboard(800);
        recordRoute("/recipes/[id]/edit");
        await render(<LiftedView />);

        await keyboard.show(0);

        expect(captureMessage).toHaveBeenCalledTimes(1);
        expect(captureMessage).toHaveBeenCalledWith("Keyboard lift out of range", {
          level: "warning",
          fingerprint: ["Keyboard lift out of range"],
          tags: {
            route: "/recipes/[id]/edit",
            appState: "active",
            rawLift: 800,
            screenY: 0,
            keyboardHeight: 300,
            windowHeight: WINDOW_HEIGHT,
          },
        });
      });

      it("should send only one message in a session, however many bad announcements come", async () => {
        const keyboard = stubKeyboard(800);
        await render(<LiftedView />);

        await keyboard.show(0);
        await keyboard.hide();
        await keyboard.show(-4000, 5000);

        expect(captureMessage).toHaveBeenCalledTimes(1);
      });

      it("should send nothing for a keyboard announced where it is", async () => {
        const keyboard = stubKeyboard(800);
        await render(<LiftedView />);

        await keyboard.show(560);

        expect(captureMessage).not.toHaveBeenCalled();
      });

      it("should send nothing for a keyboard announced where it is, with a navigation bar under the view", async () => {
        const keyboard = stubKeyboard(800);
        await render(<LiftedView navigationBarInset={48} />);

        await keyboard.show(452);

        expect(captureMessage).not.toHaveBeenCalled();
      });
    });
  });

  describe("on iOS", () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, "OS", "ios");
    });

    it("should lift by the part of the view the keyboard covers, as it did before the cap", async () => {
      const keyboard = stubKeyboard(800);
      await render(<LiftedView />);

      await keyboard.show(0);

      expect(screen.getByText("Lift 800")).toBeOnTheScreen();
      expect(captureMessage).not.toHaveBeenCalled();
    });

    it("should not listen to the app state", async () => {
      stubKeyboard(800);
      const addAppStateListener = jest.spyOn(AppState, "addEventListener");
      // Jest's own app state has been listened to by the renderer before the view is.
      addAppStateListener.mockClear();

      await render(<LiftedView />);

      expect(addAppStateListener).not.toHaveBeenCalled();
    });
  });
});
