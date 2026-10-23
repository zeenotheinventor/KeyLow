import { act, render, screen, userEvent } from "@testing-library/react-native";

import { SessionBar } from "../../components/SessionBar";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

// Thursday 15 October 2026, 19:00 in London, where Legs started at 18:30.
const NOW = new Date("2026-10-15T18:00:00Z");
const STARTED_AT = "2026-10-15T18:30:00+01:00";

// Only the date is faked, so the clock's own interval is the one that runs.
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
] as const;

async function renderBar(overrides: Partial<React.ComponentProps<typeof SessionBar>> = {}) {
  const onPress = jest.fn();
  await render(
    <ThemeProvider fixedPreference="dark">
      <SessionBar
        dayName="Legs"
        setsLogged={8}
        setsPlanned={16}
        startedAt={STARTED_AT}
        onPress={onPress}
        {...overrides}
      />
    </ThemeProvider>,
  );
  return onPress;
}

const bar = () => screen.getByRole("button", { name: /Open session$/ });

describe("the session bar", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/SessionBar"]);
  });

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW, doNotFake: [...realTimers] });
    registerAppStyles(kitStyles);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should be named for the day, the whole minutes and the sets, and offer to open the session", async () => {
    await renderBar();

    expect(
      screen.getByRole("button", {
        name: "Legs in progress, 30 minutes, 8 of 16 sets. Open session",
      }),
    ).toBeOnTheScreen();
  });

  it("should show the day name and the clock with the sets, as the board draws them", async () => {
    await renderBar();

    expect(bar()).toHaveTextContent(/Legs/);
    expect(bar()).toHaveTextContent(/30:00 · 8 of 16 sets/);
  });

  it("should tick the clock every second", async () => {
    await renderBar();

    await act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(bar()).toHaveTextContent(/30:01 · 8 of 16 sets/);
  });

  it("should keep its accessible name for a whole minute, so a screen reader is not read every second", async () => {
    await renderBar();

    await act(() => {
      jest.advanceTimersByTime(59_000);
    });

    expect(bar()).toHaveTextContent(/30:59 · 8 of 16 sets/);
    expect(
      screen.getByRole("button", {
        name: "Legs in progress, 30 minutes, 8 of 16 sets. Open session",
      }),
    ).toBeOnTheScreen();
  });

  it("should change its accessible name when the minute turns", async () => {
    await renderBar();

    await act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(
      screen.getByRole("button", {
        name: "Legs in progress, 31 minutes, 8 of 16 sets. Open session",
      }),
    ).toBeOnTheScreen();
  });

  it("should read 00:00 and under a minute for a start that is after the phone's clock, never a negative time", async () => {
    await renderBar({ startedAt: "2026-10-15T19:05:00+01:00" });

    expect(bar()).toHaveTextContent(/00:00 · 8 of 16 sets/);
    expect(
      screen.getByRole("button", {
        name: "Legs in progress, under a minute, 8 of 16 sets. Open session",
      }),
    ).toBeOnTheScreen();
  });

  it("should show the sets without a total for a session that follows no routine day", async () => {
    await renderBar({ dayName: null, setsLogged: 5, setsPlanned: 0 });

    expect(bar()).toHaveTextContent(/30:00 · 5 sets/);
  });

  it("should open the session when pressed", async () => {
    const onPress = await renderBar();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    await user.press(bar());

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
