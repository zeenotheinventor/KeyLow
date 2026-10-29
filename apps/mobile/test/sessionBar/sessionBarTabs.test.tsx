import { KeyLowProvider } from "@keylow/api-client";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { ExpoRoot, Slot } from "expo-router";
import { getMockContext } from "expo-router/testing-library";
import { Text } from "react-native";

import TabsLayout from "../../app/(tabs)/_layout";
import { ThemeProvider } from "../../lib/theme";
import { createDiaryQueryClient } from "../support/diaryBackend";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { goldenLegsOpen, legsRoutine } from "../support/sessionGoldenLegs";
import {
  resetTrainBackend,
  trainBackend,
  trainClient,
  trainRequestsTo,
} from "../support/trainBackend";

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

// Counts the draws of the tab bar by the hook it calls on every draw, so a test can show the bar's clock does not draw it.
const mockTabBarDraws = jest.fn();
jest.mock("../../lib/viewedDay", () => {
  const actual = jest.requireActual<typeof import("../../lib/viewedDay")>("../../lib/viewedDay");

  return {
    ...actual,
    useViewedDay: () => {
      mockTabBarDraws();

      return actual.useViewedDay();
    },
  };
});

// The clock the screens read, which a test moves with `moveClockTo`.
let mockNow = new Date("2026-10-15T18:00:00Z");
const mockClockListeners = new Set<() => void>();
jest.mock("../../lib/useNow", () => {
  const { useSyncExternalStore } = jest.requireActual<typeof import("react")>("react");

  return {
    useNow: () =>
      useSyncExternalStore(
        (listener: () => void) => {
          mockClockListeners.add(listener);

          return () => {
            mockClockListeners.delete(listener);
          };
        },
        () => mockNow,
      ),
  };
});

async function moveClockTo(instant: Date) {
  await act(() => {
    mockNow = instant;
    for (const listener of mockClockListeners) {
      listener();
    }
  });
}

let queryClient: QueryClient;

function Providers() {
  return (
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={trainClient} queryClient={queryClient}>
        <Slot />
      </KeyLowProvider>
    </ThemeProvider>
  );
}

const standIn = (text: string) =>
  function StandIn() {
    return <Text role="heading">{text}</Text>;
  };

const routes = {
  _layout: Providers,
  "(tabs)/_layout": TabsLayout,
  "(tabs)/dashboard": standIn("Dashboard screen"),
  "(tabs)/diary": standIn("Diary screen"),
  "(tabs)/train": standIn("Train screen"),
  "(tabs)/more": standIn("More screen"),
  session: standIn("Session screen"),
};

async function renderApp(location: string) {
  queryClient = createDiaryQueryClient();
  await render(<ExpoRoot context={getMockContext(routes)} location={location} />);
}

// Thursday 15 October 2026, 19:00 in London, where Legs started at 18:30. Only the date is faked.
const NOW = new Date("2026-10-15T18:00:00Z");
const realTimers = [
  "hrtime",
  "nextTick",
  "performance",
  "queueMicrotask",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "requestIdleCallback",
  "cancelIdleCallback",
  "setImmediate",
  "clearImmediate",
  "setInterval",
  "clearInterval",
  "setTimeout",
  "clearTimeout",
] as const;

const BAR_NAME = "Legs in progress, 30 minutes, 8 of 16 sets. Open session";
const bar = () => screen.findByRole("button", { name: BAR_NAME });

const tabs = [
  ["dashboard", "Dashboard screen"],
  ["diary", "Diary screen"],
  ["train", "Train screen"],
  ["more", "More screen"],
] as const;

describe("the session bar in the tab shell", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/SessionBar", "components/MainTabBar"]);
  });

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW, doNotFake: [...realTimers] });
    registerAppStyles(kitStyles);
    resetTrainBackend();
    mockTabBarDraws.mockClear();
    mockNow = NOW;
  });

  afterEach(async () => {
    await cleanup();
    jest.useRealTimers();
    queryClient.clear();
  });

  describe("with a session open", () => {
    beforeEach(() => {
      trainBackend.routine = legsRoutine;
      trainBackend.activeSession = goldenLegsOpen();
    });

    it.each(tabs)("should show the bar on %s", async (tab, heading) => {
      await renderApp(`/${tab}`);
      await screen.findByRole("heading", { name: heading });

      expect(await bar()).toBeOnTheScreen();
    });

    it("should show the day and the clock on the bar", async () => {
      await renderApp("/more");

      expect(await bar()).toHaveTextContent(/Legs/);
      expect(await bar()).toHaveTextContent(/30:00 · 8 of 16 sets/);
    });

    it.each(["dashboard", "diary"])(
      "should sit between the search launcher and the tab bar on %s",
      async (tab) => {
        await renderApp(`/${tab}`);
        await bar();

        const controls = screen.getAllByRole(/^(tab|button)$/);
        const indexOf = (control: ReturnType<typeof screen.getByRole>) => controls.indexOf(control);
        const launcher = indexOf(screen.getByRole("button", { name: "Search for a food" }));
        const sessionBar = indexOf(screen.getByRole("button", { name: BAR_NAME }));
        const firstTab = indexOf(screen.getByRole("tab", { name: "Dashboard" }));

        expect(launcher).toBeLessThan(sessionBar);
        expect(sessionBar).toBeLessThan(firstTab);
      },
    );

    it("should open the session screen when pressed", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      await renderApp("/train");

      await user.press(await bar());

      expect(await screen.findByRole("heading", { name: "Session screen" })).toBeOnTheScreen();
    });

    describe("the clock", () => {
      it("should tick the bar every second without drawing the tab bar again", async () => {
        await renderApp("/more");
        expect(await bar()).toHaveTextContent(/30:00 · 8 of 16 sets/);
        const drawsBefore = mockTabBarDraws.mock.calls.length;

        await moveClockTo(new Date(NOW.getTime() + 3000));

        expect(screen.getByRole("button", { name: BAR_NAME })).toHaveTextContent(
          /30:03 · 8 of 16 sets/,
        );
        expect(mockTabBarDraws).toHaveBeenCalledTimes(drawsBefore);
      });
    });
  });

  describe("with no session open", () => {
    it.each(tabs)("should not show the bar on %s", async (tab, heading) => {
      await renderApp(`/${tab}`);
      await screen.findByRole("heading", { name: heading });
      await waitFor(() => {
        expect(trainRequestsTo("active_session")).toBe(1);
      });
      await act(() => Promise.resolve());

      expect(screen.queryByRole("button", { name: /Open session$/ })).not.toBeOnTheScreen();
    });
  });
});
