import { KeyLowProvider } from "@keylow/api-client";
import { cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { ExpoRoot, Slot } from "expo-router";
import { getMockContext } from "expo-router/testing-library";
import { createElement } from "react";
import { Text } from "react-native";
import { setUpTests } from "react-native-reanimated";

import TrainLayout from "../app/(tabs)/train/_layout";
import SessionDetailRoute from "../app/(tabs)/train/history/[id]";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import {
  GOLDEN_PULL_ID,
  goldenPull,
  pullRoutine,
  resetSessionDetailBackend,
  sessionDetailBackend,
  sessionDetailClient,
} from "./support/sessionDetailBackend";
import { trainBackend } from "./support/trainBackend";
import HistoryRoute from "../app/(tabs)/train/history";

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

setUpTests();

// The history list is stood in for by a heading, so what is tested is which route file the router picks for
// an address, and that the session's id reaches the screen from the address.
const mockHeading = (text: string) =>
  jest
    .requireActual<typeof import("react")>("react")
    .createElement(
      jest.requireActual<typeof import("react-native")>("react-native").Text,
      { role: "heading" },
      text,
    );
jest.mock("../components/HistoryScreen", () => ({
  HistoryScreen: () => mockHeading("History list"),
}));

const TabsStandIn = () => <Slot />;
const TrainStandIn = () => createElement(Text, { role: "heading" }, "Train screen");

let queryClient: QueryClient;

function Providers() {
  return (
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={sessionDetailClient} queryClient={queryClient}>
        <ToastProvider>
          <Slot />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>
  );
}

async function openAt(location: string) {
  await render(
    <ExpoRoot
      context={getMockContext({
        _layout: Providers,
        "(tabs)/_layout": TabsStandIn,
        "(tabs)/train/_layout": TrainLayout,
        "(tabs)/train/index": TrainStandIn,
        "(tabs)/train/history": HistoryRoute,
        "(tabs)/train/history/[id]": SessionDetailRoute,
      })}
      location={location}
    />,
  );
}

describe("the session detail's address beside the history list's", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/SessionDetailScreen", "app"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetSessionDetailBackend();
    queryClient = createDiaryQueryClient();
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
  });

  it("should still open the history list at its own address", async () => {
    await openAt("/train/history");

    expect(await screen.findByRole("heading", { name: "History list" })).toBeOnTheScreen();
  });

  it("should open the session whose id is in the address", async () => {
    sessionDetailBackend.sessions = [goldenPull];
    trainBackend.routine = pullRoutine;

    await openAt(`/train/history/${GOLDEN_PULL_ID}`);

    expect(await screen.findByText("Tuesday 13 October · 18:00 to 18:51")).toBeOnTheScreen();
    expect(sessionDetailBackend.requestedIds).toEqual([GOLDEN_PULL_ID]);
  });

  it("should show a session that is not found for an id nothing holds", async () => {
    await openAt("/train/history/00000004-0000-4000-8000-00000000dead");

    expect(await screen.findByText("Session not found")).toBeOnTheScreen();
  });

  it("should go to the history list from Open history on a session that is not found", async () => {
    const user = userEvent.setup();
    await openAt("/train/history/00000004-0000-4000-8000-00000000dead");

    await user.press(await screen.findByRole("button", { name: "Open history" }));

    expect(await screen.findByRole("heading", { name: "History list" })).toBeOnTheScreen();
  });

  it("should go to the history list from Back to History when nothing is before it", async () => {
    sessionDetailBackend.sessions = [goldenPull];
    trainBackend.routine = pullRoutine;
    const user = userEvent.setup();
    await openAt(`/train/history/${GOLDEN_PULL_ID}`);

    await user.press(await screen.findByRole("button", { name: "Back to History" }));

    expect(await screen.findByRole("heading", { name: "History list" })).toBeOnTheScreen();
  });

  describe("opened from the Train home, with ?from=train", () => {
    it("should name Back for the Train home", async () => {
      sessionDetailBackend.sessions = [goldenPull];
      trainBackend.routine = pullRoutine;

      await openAt(`/train/history/${GOLDEN_PULL_ID}?from=train`);

      expect(await screen.findByRole("button", { name: "Back to Train" })).toBeOnTheScreen();
    });

    it("should go to the Train home from Back to Train when nothing is before it", async () => {
      sessionDetailBackend.sessions = [goldenPull];
      trainBackend.routine = pullRoutine;
      const user = userEvent.setup();
      await openAt(`/train/history/${GOLDEN_PULL_ID}?from=train`);

      await user.press(await screen.findByRole("button", { name: "Back to Train" }));

      expect(await screen.findByRole("heading", { name: "Train screen" })).toBeOnTheScreen();
    });

    it("should name Back for the Train home on a session that is not found too", async () => {
      await openAt("/train/history/00000004-0000-4000-8000-00000000dead?from=train");

      expect(await screen.findByRole("button", { name: "Back to Train" })).toBeOnTheScreen();
    });
  });

  describe("opened from the history list, with no origin", () => {
    it("should name Back for the history list", async () => {
      sessionDetailBackend.sessions = [goldenPull];
      trainBackend.routine = pullRoutine;

      await openAt(`/train/history/${GOLDEN_PULL_ID}`);

      expect(await screen.findByRole("button", { name: "Back to History" })).toBeOnTheScreen();
    });
  });
});
