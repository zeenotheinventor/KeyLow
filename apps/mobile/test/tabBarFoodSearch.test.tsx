import { onlineManager } from "@tanstack/react-query";
import { act, render, screen, userEvent } from "@testing-library/react-native";
import { ExpoRoot, Slot, useLocalSearchParams } from "expo-router";
import { getMockContext } from "expo-router/testing-library";
import { useEffect, useSyncExternalStore } from "react";
import { Text } from "react-native";

import TabsLayout from "../app/(tabs)/_layout";
import { ThemeProvider } from "../lib/theme";
import { setViewedDay } from "../lib/viewedDay";
import {
  mockUseProfileTimeZone,
  resetApiClientMock,
  termsAccepted,
} from "./foods/support/apiClientMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
// The profile's time zone, which says which day today is. Only the hooks the tab bar reads are replaced.
jest.mock(
  "@keylow/api-client",
  () =>
    jest.requireActual<{ mockApiClient: unknown }>("./foods/support/apiClientMock").mockApiClient,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

function Providers() {
  return (
    <ThemeProvider fixedPreference="dark">
      <Slot />
    </ThemeProvider>
  );
}

// The diary tells the tab bar which day it shows, as the real one does once it knows its zone. A test turns
// it off to be on the Diary tab before that has happened.
let diaryReportsItsDay = true;

function DiaryStandIn() {
  useEffect(() => {
    if (diaryReportsItsDay) {
      setViewedDay("2026-10-14");
    }

    return () => {
      setViewedDay(null);
    };
  }, []);

  return <Text role="heading">Diary</Text>;
}

function SearchStandIn() {
  const { day, time } = useLocalSearchParams<{ day?: string; time?: string }>();

  return <Text>{`Search sheet day=${day ?? "none"} time=${time ?? "none"}`}</Text>;
}

function ScanStandIn() {
  const { day } = useLocalSearchParams<{ day?: string }>();

  return <Text>{`Scan screen day=${day ?? "none"}`}</Text>;
}

const standIn = (text: string) =>
  function StandIn() {
    return <Text role="heading">{text}</Text>;
  };

function MoreStandIn() {
  return <Text role="heading">More screen</Text>;
}

const routes = {
  _layout: Providers,
  "(tabs)/_layout": TabsLayout,
  "(tabs)/dashboard": standIn("Dashboard screen"),
  "(tabs)/diary": DiaryStandIn,
  "(tabs)/train": standIn("Train screen"),
  "(tabs)/more": MoreStandIn,
  "foods/index": SearchStandIn,
  "foods/scan": ScanStandIn,
};

async function renderApp(location: string) {
  await render(<ExpoRoot context={getMockContext(routes)} location={location} />);
}

// 12:40 on Thursday 15 October 2026 in London. Only the clock is faked: the router answers in real time.
const NOW = new Date("2026-10-15T11:40:30Z");
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

// What the read of the profile's time zone says. A test changes it to let the zone arrive while the bar is up.
type ZoneRead = { data: string | null | undefined; isPending: boolean; isError: boolean };
const zoneNotKnownYet: ZoneRead = { data: undefined, isPending: true, isError: false };
const zoneListeners = new Set<() => void>();
let zoneRead: ZoneRead = { data: "Europe/London", isPending: false, isError: false };

async function setZoneRead(next: ZoneRead) {
  await act(() => {
    zoneRead = next;
    for (const listener of zoneListeners) {
      listener();
    }
  });
}

function useZoneRead(options?: { enabled?: boolean }): ZoneRead {
  const read = useSyncExternalStore(
    (listener) => {
      zoneListeners.add(listener);

      return () => {
        zoneListeners.delete(listener);
      };
    },
    () => zoneRead,
  );

  // A disabled query has fetched nothing, as the tab bar's would be before the Terms are accepted.
  return options?.enabled === false ? zoneNotKnownYet : read;
}

const plus = () => screen.getByRole("button", { name: "Find food" });
const dock = () => screen.getByRole("button", { name: "Search for a food" });
const scan = () => screen.getByRole("button", { name: "Scan barcode" });

describe("the tab bar's routes into food search", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW, doNotFake: [...realTimers] });
    diaryReportsItsDay = true;
    registerAppStyles(kitStyles);
    resetApiClientMock();
    zoneRead = { data: "Europe/London", isPending: false, isError: false };
    mockUseProfileTimeZone.mockImplementation(useZoneRead);
  });

  afterEach(async () => {
    await act(() => {
      onlineManager.setOnline(true);
    });
    jest.useRealTimers();
  });

  describe("the centre plus", () => {
    // The diary stand-in is on 14 October and the clock says the 15th, so the two days cannot be mixed up.
    it.each([
      ["dashboard", "Dashboard screen", "2026-10-15"],
      ["train", "Train screen", "2026-10-15"],
      ["more", "More screen", "2026-10-15"],
      ["diary", "Diary", "2026-10-14"],
    ])(
      "should open search in log mode on %s, for the day it logs to, with no time",
      async (tab, heading, day) => {
        const user = userEvent.setup();
        await renderApp(`/${tab}`);
        await screen.findByRole("heading", { name: heading });

        await user.press(await screen.findByRole("button", { name: "Find food" }));

        expect(await screen.findByText(`Search sheet day=${day} time=none`)).toBeOnTheScreen();
      },
    );

    it("should take today in the profile's zone, which is the next day in Auckland at this instant", async () => {
      jest.setSystemTime(new Date("2026-10-15T23:30:00Z"));
      await setZoneRead({ data: "Pacific/Auckland", isPending: false, isError: false });
      const user = userEvent.setup();
      await renderApp("/dashboard");

      await user.press(await screen.findByRole("button", { name: "Find food" }));

      expect(await screen.findByText("Search sheet day=2026-10-16 time=none")).toBeOnTheScreen();
    });

    it("should read the clock when it is pressed, so a tab left open across midnight is not stale", async () => {
      const user = userEvent.setup();
      await renderApp("/more");
      await screen.findByRole("heading", { name: "More screen" });

      jest.setSystemTime(new Date("2026-10-16T00:30:00Z"));
      await user.press(plus());

      expect(await screen.findByText("Search sheet day=2026-10-16 time=none")).toBeOnTheScreen();
    });

    it("should use today and not the day the diary was on, on More and the Dashboard afterwards", async () => {
      const user = userEvent.setup();
      await renderApp("/diary");
      await user.press(await screen.findByRole("tab", { name: "More" }));
      await screen.findByRole("heading", { name: "More screen" });

      await user.press(plus());

      expect(await screen.findByText("Search sheet day=2026-10-15 time=none")).toBeOnTheScreen();
    });

    it("should use today on the Dashboard after the diary was on a past day", async () => {
      const user = userEvent.setup();
      await renderApp("/diary");
      await user.press(await screen.findByRole("tab", { name: "Dashboard" }));
      await screen.findByRole("heading", { name: "Dashboard screen" });

      await user.press(plus());

      expect(await screen.findByText("Search sheet day=2026-10-15 time=none")).toBeOnTheScreen();
    });

    it("should use today on the Diary before the diary has said which day it shows", async () => {
      diaryReportsItsDay = false;
      const user = userEvent.setup();
      await renderApp("/diary");
      await screen.findByRole("heading", { name: "Diary" });

      await user.press(plus());

      expect(await screen.findByText("Search sheet day=2026-10-15 time=none")).toBeOnTheScreen();
    });

    it("should go back to the day on view when the person returns to the diary", async () => {
      const user = userEvent.setup();
      await renderApp("/diary");
      await user.press(await screen.findByRole("tab", { name: "More" }));
      await screen.findByRole("heading", { name: "More screen" });
      await user.press(screen.getByRole("tab", { name: "Diary" }));
      await screen.findByRole("heading", { name: "Diary" });

      await user.press(plus());

      expect(await screen.findByText("Search sheet day=2026-10-14 time=none")).toBeOnTheScreen();
    });
  });

  describe("the search dock", () => {
    it("should open search for today from the dock on the Dashboard, with no time", async () => {
      const user = userEvent.setup();
      await renderApp("/dashboard");

      await user.press(await screen.findByRole("button", { name: "Search for a food" }));

      expect(await screen.findByText("Search sheet day=2026-10-15 time=none")).toBeOnTheScreen();
    });

    it("should open search for the day on view from the dock on the Diary, with no time", async () => {
      const user = userEvent.setup();
      await renderApp("/diary");

      await user.press(await screen.findByRole("button", { name: "Search for a food" }));

      expect(await screen.findByText("Search sheet day=2026-10-14 time=none")).toBeOnTheScreen();
    });

    it("should open the scanner for today from the scan control on the Dashboard", async () => {
      const user = userEvent.setup();
      await renderApp("/dashboard");

      await user.press(await screen.findByRole("button", { name: "Scan barcode" }));

      expect(await screen.findByText("Scan screen day=2026-10-15")).toBeOnTheScreen();
    });

    it("should open the scanner for the day on view from the scan control on the Diary", async () => {
      const user = userEvent.setup();
      await renderApp("/diary");

      await user.press(await screen.findByRole("button", { name: "Scan barcode" }));

      expect(await screen.findByText("Scan screen day=2026-10-14")).toBeOnTheScreen();
    });
  });

  describe("before the profile's time zone is known", () => {
    it.each([
      ["dashboard", "Dashboard screen"],
      ["diary", "Diary"],
    ])(
      "should disable the plus, the dock and its scan control on %s, and open nothing",
      async (tab, heading) => {
        await setZoneRead(zoneNotKnownYet);
        const user = userEvent.setup();
        await renderApp(`/${tab}`);
        await screen.findByRole("heading", { name: heading });

        await user.press(plus());
        await user.press(dock());
        await user.press(scan());

        expect(plus()).toBeDisabled();
        expect(dock()).toBeDisabled();
        expect(scan()).toBeDisabled();
        expect(screen.queryByText(/^Search sheet/)).not.toBeOnTheScreen();
        expect(screen.queryByText(/^Scan screen/)).not.toBeOnTheScreen();
      },
    );

    it.each([
      ["train", "Train screen"],
      ["more", "More screen"],
    ])("should disable the plus on %s, and open nothing", async (tab, heading) => {
      await setZoneRead(zoneNotKnownYet);
      const user = userEvent.setup();
      await renderApp(`/${tab}`);
      await screen.findByRole("heading", { name: heading });

      await user.press(plus());

      expect(plus()).toBeDisabled();
      expect(screen.queryByText(/^Search sheet/)).not.toBeOnTheScreen();
    });

    it("should disable them when the read failed, and enable them when the retry brings the zone", async () => {
      await setZoneRead({ data: undefined, isPending: false, isError: true });
      await renderApp("/dashboard");
      await screen.findByRole("heading", { name: "Dashboard screen" });
      expect(plus()).toBeDisabled();
      expect(dock()).toBeDisabled();

      await setZoneRead({ data: "Europe/London", isPending: false, isError: false });

      expect(plus()).toBeEnabled();
      expect(dock()).toBeEnabled();
      expect(scan()).toBeEnabled();
    });

    it("should disable them until the Terms are accepted, because the read is then not enabled", async () => {
      termsAccepted.current = false;
      const user = userEvent.setup();
      await renderApp("/dashboard");
      await screen.findByRole("heading", { name: "Dashboard screen" });

      await user.press(plus());
      await user.press(dock());

      expect(plus()).toBeDisabled();
      expect(dock()).toBeDisabled();
      expect(screen.queryByText(/^Search sheet/)).not.toBeOnTheScreen();
      expect(mockUseProfileTimeZone).toHaveBeenCalledWith({ enabled: false });
    });

    it("should enable them as soon as the zone arrives", async () => {
      await setZoneRead(zoneNotKnownYet);
      const user = userEvent.setup();
      await renderApp("/dashboard");
      await screen.findByRole("heading", { name: "Dashboard screen" });
      expect(plus()).toBeDisabled();

      await setZoneRead({ data: "Europe/London", isPending: false, isError: false });
      await user.press(plus());

      expect(await screen.findByText("Search sheet day=2026-10-15 time=none")).toBeOnTheScreen();
    });

    it("should count a missing profile row as UTC, as the Dashboard does", async () => {
      jest.setSystemTime(new Date("2026-10-15T23:30:00Z"));
      await setZoneRead({ data: null, isPending: false, isError: false });
      const user = userEvent.setup();
      await renderApp("/more");

      await user.press(await screen.findByRole("button", { name: "Find food" }));

      expect(await screen.findByText("Search sheet day=2026-10-15 time=none")).toBeOnTheScreen();
    });
  });

  describe("offline", () => {
    it.each([
      ["dashboard", "Dashboard screen"],
      ["diary", "Diary"],
      ["train", "Train screen"],
      ["more", "More screen"],
    ])("should dim and disable the centre plus on %s, and open nothing", async (tab, heading) => {
      const user = userEvent.setup();
      await renderApp(`/${tab}`);
      await screen.findByRole("heading", { name: heading });
      await act(() => {
        onlineManager.setOnline(false);
      });

      await user.press(plus());

      expect(plus()).toBeDisabled();
      expect(screen.queryByText(/^Search sheet/)).not.toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: heading })).toBeOnTheScreen();
    });

    it.each([
      ["dashboard", "Dashboard screen"],
      ["diary", "Diary"],
    ])(
      "should dim and disable the search dock and its scan control on %s, and open nothing",
      async (tab, heading) => {
        const user = userEvent.setup();
        await renderApp(`/${tab}`);
        await screen.findByRole("heading", { name: heading });
        await act(() => {
          onlineManager.setOnline(false);
        });

        await user.press(dock());
        await user.press(scan());

        expect(dock()).toBeDisabled();
        expect(scan()).toBeDisabled();
        expect(screen.queryByText(/^Search sheet/)).not.toBeOnTheScreen();
        expect(screen.queryByText(/^Scan screen/)).not.toBeOnTheScreen();
      },
    );

    it("should recover when the connection returns", async () => {
      const user = userEvent.setup();
      await renderApp("/more");
      await screen.findByRole("heading", { name: "More screen" });
      await act(() => {
        onlineManager.setOnline(false);
      });
      expect(plus()).toBeDisabled();

      await act(() => {
        onlineManager.setOnline(true);
      });
      await user.press(plus());

      expect(await screen.findByText("Search sheet day=2026-10-15 time=none")).toBeOnTheScreen();
    });
  });
});
