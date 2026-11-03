import { KeyLowProvider } from "@keylow/api-client";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react-native";

import SessionRoute from "../app/session";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { SNAPSHOT_STORAGE_KEY } from "../lib/widgets";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { goldenLegsOpen, legsRoutine } from "./support/sessionGoldenLegs";
import { resetTrainBackend, trainBackend } from "./support/trainBackend";
import { goldenRoutine, LEGS_ID } from "./support/trainGoldenWeek";
import { resetTrainWrites, trainWrites, trainWritesClient } from "./support/trainWritesBackend";
import { installVirtualClock } from "./support/virtualClock";
import { testSnapshot } from "./support/widgetFixtures";

import type { QueryClient } from "@tanstack/react-query";

const mockStorage = new Map<string, string>();
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => Promise.resolve(mockStorage.get(key) ?? null),
    setItem: (key: string, value: string) => {
      mockStorage.set(key, value);
      return Promise.resolve();
    },
  },
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
jest.mock("../lib/useNow", () => ({ useNow: () => new Date("2026-10-15T16:55:00Z") }));

let queryClient: QueryClient;

async function openLink(params: Record<string, string>) {
  routerMock.searchParams = params;
  queryClient = createDiaryQueryClient();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={trainWritesClient} queryClient={queryClient}>
        <ToastProvider>
          <SessionRoute />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

// Waits until the link's reads have been made, then gives it time to start something, so a test that
// expects nothing is not a test that looked too early.
async function settle() {
  await waitFor(() => {
    expect(trainBackend.requests).toContain("active_session");
    expect(trainBackend.requests).toContain("week_sessions");
  });
  await act(() => jest.advanceTimersByTimeAsync(300));
}

// The used nonces live as long as the app does, so each test has a nonce of its own.
let nonce = "";

function storedNonce(): string | null {
  const stored = mockStorage.get(SNAPSHOT_STORAGE_KEY);
  const parsed: unknown = stored === undefined ? null : JSON.parse(stored);
  return typeof parsed === "object" &&
    parsed !== null &&
    "nonce" in parsed &&
    typeof parsed.nonce === "string"
    ? parsed.nonce
    : null;
}
let nonceCount = 0;

describe("a widget link to the session", () => {
  beforeEach(() => {
    installVirtualClock({ now: new Date("2026-10-15T16:55:00Z") });
    resetRouterMock();
    resetTrainBackend();
    resetTrainWrites();
    mockStorage.clear();
    nonceCount += 1;
    nonce = `nonce-for-test-${String(nonceCount).padStart(8, "0")}`;
    mockStorage.set(SNAPSHOT_STORAGE_KEY, JSON.stringify(testSnapshot({ nonce })));
    trainBackend.routine = goldenRoutine;
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
    jest.useRealTimers();
  });

  it("should start the planned day for the snapshot's nonce", async () => {
    await openLink({ start: "planned", nonce });

    await waitFor(() => {
      expect(trainWrites.inserted).toHaveLength(1);
    });
    expect(trainWrites.inserted[0]).toMatchObject({ routine_day_id: LEGS_ID });
  });

  it("should start a session that follows no routine day for the empty link", async () => {
    await openLink({ start: "empty", nonce });

    await waitFor(() => {
      expect(trainWrites.inserted).toHaveLength(1);
    });
    expect(trainWrites.inserted[0]).toMatchObject({ routine_day_id: null });
  });

  it("should do nothing for a nonce the snapshot does not hold", async () => {
    await openLink({ start: "planned", nonce: "an-unknown-nonce-0123456789" });
    await settle();

    expect(trainWrites.inserted).toHaveLength(0);
  });

  it("should do nothing for a link without a nonce", async () => {
    await openLink({ start: "planned" });
    await settle();

    expect(trainWrites.inserted).toHaveLength(0);
  });

  it("should do nothing when the app has written no snapshot", async () => {
    mockStorage.clear();
    await openLink({ start: "planned", nonce });
    await settle();

    expect(trainWrites.inserted).toHaveLength(0);
  });

  it("should open the running session and start no other", async () => {
    trainBackend.routine = legsRoutine;
    trainBackend.activeSession = goldenLegsOpen();
    await openLink({ start: "planned", nonce });

    expect(await screen.findByRole("heading", { name: "Legs" })).toBeOnTheScreen();
    await settle();
    expect(trainWrites.inserted).toHaveLength(0);
  });

  it("should not start anything again for the nonce a link has used, even after a relaunch", async () => {
    await openLink({ start: "planned", nonce });
    await waitFor(() => {
      expect(trainWrites.inserted).toHaveLength(1);
    });
    await cleanup();
    resetTrainWrites();
    trainBackend.activeSession = null;
    await openLink({ start: "planned", nonce });
    await settle();

    expect(trainWrites.inserted).toHaveLength(0);
    expect(storedNonce()).not.toBe(nonce);
  });

  it("should leave the button live after a failed start, with the new nonce", async () => {
    trainWrites.failInserts = true;
    await openLink({ start: "planned", nonce });
    await waitFor(() => {
      expect(storedNonce()).not.toBe(nonce);
    });
    await act(() => jest.advanceTimersByTimeAsync(300));
    expect(trainWrites.inserted).toHaveLength(0);
    await cleanup();
    const renewed = storedNonce();
    expect(renewed).not.toBe(nonce);
    resetTrainWrites();

    await openLink({ start: "planned", nonce: renewed ?? "" });

    await waitFor(() => {
      expect(trainWrites.inserted).toHaveLength(1);
    });
  });
});
