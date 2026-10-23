import "../support/gestureHandler";

import { KeyLowProvider } from "@keylow/api-client";
import { act, render, screen, waitFor } from "@testing-library/react-native";

import { WeightScreen } from "../../components/WeightScreen";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock } from "../support/expoRouterMock";
import {
  createWeightQueryClient,
  resetWeightBackend,
  weightBackend,
  weightClient,
  weighInRow,
} from "../support/weightBackend";

// The day names ("Today", "Yesterday") are read in the profile's time zone: UTC when it has none, and not
// before the zone has been read.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

// At 23:30 UTC on 23 October it is already the 24th in London (British Summer Time), so a reading dated the
// 23rd is today in UTC and yesterday in London.
function freezeClockAtLateEveningUtc() {
  jest.useFakeTimers({
    now: new Date("2026-10-23T23:30:00Z"),
    doNotFake: [
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
    ],
  });
}

async function renderWeightScreen() {
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={weightClient} queryClient={createWeightQueryClient()}>
        <WeightScreen />
      </KeyLowProvider>
    </ThemeProvider>,
  );
  await waitFor(() => {
    expect(weightBackend.weighInRequestCount).toBeGreaterThan(0);
  });
}

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

describe("the Weight screen's days", () => {
  beforeEach(() => {
    resetRouterMock();
    resetWeightBackend();
    freezeClockAtLateEveningUtc();
    weightBackend.weighIns = [
      weighInRow({ localDate: "2026-10-23", utcTime: "07:42", weightKg: 81.6, timeZone: "UTC" }),
    ];
  });

  afterEach(async () => {
    await settle();
    jest.useRealTimers();
  });

  it("should read the day in London when the profile says London", async () => {
    await renderWeightScreen();

    expect(await screen.findByLabelText(/^Yesterday, 07:42/)).toBeOnTheScreen();
  });

  it("should read the day in UTC when the profile has no time zone", async () => {
    weightBackend.timeZone = null;
    await renderWeightScreen();

    expect(await screen.findByLabelText("Today, 07:42 · Added by you, 81.6 kg")).toBeOnTheScreen();
  });

  it("should read the day in UTC when the time zone cannot be read, and still show the list", async () => {
    weightBackend.timeZoneReadFails = true;
    await renderWeightScreen();

    expect(await screen.findByLabelText("Today, 07:42 · Added by you, 81.6 kg")).toBeOnTheScreen();
    expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
  });

  it("should keep loading until the time zone is read, then draw the rows", async () => {
    let releaseTimeZone = () => {};
    weightBackend.timeZoneGate = new Promise<void>((resolve) => {
      releaseTimeZone = resolve;
    });
    await renderWeightScreen();
    await settle();

    expect(screen.getByRole("status", { name: "Loading your weigh-ins" })).toBeOnTheScreen();
    expect(screen.queryByLabelText(/ kg$/)).not.toBeOnTheScreen();
    expect(screen.queryByRole("heading", { name: "Weigh-ins" })).not.toBeOnTheScreen();

    releaseTimeZone();

    expect(await screen.findByLabelText(/^Yesterday, 07:42/)).toBeOnTheScreen();
    expect(screen.queryByRole("status", { name: "Loading your weigh-ins" })).not.toBeOnTheScreen();
  });
});
