import { act, cleanup, render, screen } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { SessionClock } from "../components/SessionClock";
import { ThemeProvider } from "../lib/theme";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

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

const STARTED_AT = "2026-10-15T18:00:00.000Z";

describe("the session clock after the app was in the background", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/SessionClock"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    jest.useFakeTimers({ now: new Date(STARTED_AT) });
  });

  afterEach(async () => {
    await cleanup();
    jest.useRealTimers();
  });

  it("should show the time since the session started, not the time the app was awake", async () => {
    await render(
      <ThemeProvider fixedPreference="dark">
        <SessionClock
          dayName="Legs"
          endedAt={null}
          setsLogged={0}
          setsPlanned={0}
          startedAt={STARTED_AT}
          onHide={jest.fn()}
        />
      </ThemeProvider>,
    );
    expect(screen.getByText("00:00 · 0 sets")).toBeOnTheScreen();

    // YouTube is in front for eight minutes: the phone's clock moves on and the app's timers do not run.
    jest.setSystemTime(new Date("2026-10-15T18:08:00.000Z"));
    await act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getByText("08:01 · 0 sets")).toBeOnTheScreen();
  });
});
