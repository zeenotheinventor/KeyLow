import { KeyLowProvider } from "@keylow/api-client";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { ExpoRoot, Slot } from "expo-router";
import { getMockContext } from "expo-router/testing-library";
import { Text } from "react-native";

import TabsLayout from "../app/(tabs)/_layout";
import DashboardRoute from "../app/(tabs)/dashboard";
import DiaryRoute from "../app/(tabs)/diary";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import {
  createDiaryQueryClient,
  diaryBackend,
  diaryClient,
  resetDiaryBackend,
  sampleDay,
} from "./support/diaryBackend";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

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
// 11:20 in London on Thursday 15 October 2026.
jest.mock("../lib/useNow", () => {
  const mockNow = new Date("2026-10-15T10:20:00Z");

  return { useNow: () => mockNow };
});

let queryClient: QueryClient;

function Providers() {
  return (
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        <ToastProvider>
          <Slot />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>
  );
}

const standIn = (text: string) =>
  function StandIn() {
    return <Text role="heading">{text}</Text>;
  };

// The real Dashboard and the real Diary under the real tab layout, so the card's link meets the Diary's own state.
const routes = {
  _layout: Providers,
  "(tabs)/_layout": TabsLayout,
  "(tabs)/dashboard": DashboardRoute,
  "(tabs)/diary": DiaryRoute,
  "(tabs)/recipes": standIn("Recipes screen"),
  "(tabs)/train": standIn("Train screen"),
  "(tabs)/more": standIn("More screen"),
  targets: standIn("Targets screen"),
};

describe("the dashboard card and the diary", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/DashboardScreen",
      "components/DiaryScreen",
      "app",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetDiaryBackend();
    diaryBackend.entries = [...sampleDay(), ...sampleDay("2026-10-14")];
    queryClient = createDiaryQueryClient();
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  async function leaveTheDiaryOnAPastDay() {
    const user = userEvent.setup();
    await render(<ExpoRoot context={getMockContext(routes)} location="/diary" />);
    await user.press(await screen.findByRole("button", { name: "Wednesday 14 October" }));
    await screen.findByRole("heading", { name: "Wed 14 Oct" });
    await user.press(screen.getByRole("tab", { name: "Dashboard" }));

    return user;
  }

  it("should show today in a diary that was left on a past day", async () => {
    const user = await leaveTheDiaryOnAPastDay();

    await user.press(await screen.findByRole("button", { name: /^Today, open the diary\. / }));

    expect(await screen.findByRole("heading", { name: "Today" })).toBeOnTheScreen();
    expect(
      await screen.findByRole("button", { name: "Thursday 15 October, today", selected: true }),
    ).toBeOnTheScreen();
  });

  it("should do it again after the diary is left on a past day a second time", async () => {
    const user = await leaveTheDiaryOnAPastDay();
    await user.press(await screen.findByRole("button", { name: /^Today, open the diary\. / }));
    await screen.findByRole("heading", { name: "Today" });
    await user.press(screen.getByRole("button", { name: "Wednesday 14 October" }));
    await screen.findByRole("heading", { name: "Wed 14 Oct" });
    await user.press(screen.getByRole("tab", { name: "Dashboard" }));

    await user.press(await screen.findByRole("button", { name: /^Today, open the diary\. / }));

    expect(await screen.findByRole("heading", { name: "Today" })).toBeOnTheScreen();
  });

  it("should leave the day alone when the diary tab is chosen from the tab bar", async () => {
    const user = await leaveTheDiaryOnAPastDay();
    await user.press(await screen.findByRole("button", { name: /^Today, open the diary\. / }));
    await screen.findByRole("heading", { name: "Today" });
    await user.press(screen.getByRole("button", { name: "Wednesday 14 October" }));
    await screen.findByRole("heading", { name: "Wed 14 Oct" });
    await user.press(screen.getByRole("tab", { name: "More" }));

    await user.press(await screen.findByRole("tab", { name: "Diary" }));

    expect(await screen.findByRole("heading", { name: "Wed 14 Oct" })).toBeOnTheScreen();
  });
});
