import "../support/gestureHandler";

import { KeyLowProvider } from "@keylow/api-client";
import { addCalendarDays, toLocalDate } from "@keylow/core/dates";
import { render, screen, userEvent, waitFor } from "@testing-library/react-native";

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

// Weigh-ins are health data: no weight, note or time reaches a log or an error.

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

const NOTE = "after the long run, felt heavy";
const levels = ["log", "info", "warn", "error"] as const;

// Everything the screen's render, reads and failures wrote to the console, as one text.
let written: string[];

function spyOnConsole() {
  written = [];
  for (const level of levels) {
    jest.spyOn(console, level).mockImplementation((...parts: unknown[]) => {
      written.push(
        parts
          .map((part) => (part instanceof Error ? String(part.cause) + part.message : String(part)))
          .join(" "),
      );
    });
  }
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

function expectNothingPrivateWritten() {
  const text = written.join("\n");
  for (const secret of ["81.6", "81.9", "99.0", "07:42", NOTE]) {
    expect(text).not.toContain(secret);
  }
}

describe("the Weight screen's console output", () => {
  beforeEach(() => {
    resetRouterMock();
    resetWeightBackend();
    spyOnConsole();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should hold no weight, note or time while it draws the list", async () => {
    const today = toLocalDate(new Date(), "Europe/London");
    weightBackend.weighIns = [
      weighInRow({
        localDate: today,
        utcTime: "07:42",
        weightKg: 81.6,
        note: NOTE,
        timeZone: "UTC",
      }),
      weighInRow({
        localDate: addCalendarDays(today, -1),
        utcTime: "07:50",
        weightKg: 81.9,
        timeZone: "UTC",
      }),
      weighInRow({ localDate: "2026-10-10", utcTime: "08:00", weightKg: 99, timeZone: "UTC" }),
    ];
    await renderWeightScreen();
    await screen.findByRole("heading", { name: "Weigh-ins" });

    expect(screen.getByLabelText(/^Today, 07:42/)).toBeOnTheScreen();
    expectNothingPrivateWritten();
  });

  it("should hold no weight, date or trend value while the trend card and the chart draw, on every range", async () => {
    const user = userEvent.setup();
    const today = toLocalDate(new Date(), "Europe/London");
    weightBackend.weighIns = [
      weighInRow({ localDate: today, utcTime: "07:42", weightKg: 81.6, timeZone: "UTC" }),
      weighInRow({
        localDate: addCalendarDays(today, -1),
        utcTime: "07:50",
        weightKg: 81.9,
        timeZone: "UTC",
      }),
      weighInRow({ localDate: "2026-10-10", utcTime: "08:00", weightKg: 99, timeZone: "UTC" }),
    ];
    await renderWeightScreen();
    await screen.findByLabelText("Trend weight");

    for (const range of ["1 week", "30 days", "1 year", "90 days"]) {
      await user.press(screen.getByRole("radio", { name: range }));
    }

    expect(
      screen.getByRole("image", { name: /^Weight over the last 90 days, trend / }),
    ).toBeOnTheScreen();
    expectNothingPrivateWritten();
    const text = written.join("\n");
    for (const secret of [today, addCalendarDays(today, -1), "2026-10-10", "81.", "99"]) {
      expect(text).not.toContain(secret);
    }
  });

  it("should hold no weight, note or time when the read fails, though the database quotes a weight", async () => {
    weightBackend.weighIns = [
      weighInRow({ localDate: "2026-10-10", utcTime: "07:42", weightKg: 81.6, note: NOTE }),
    ];
    weightBackend.weighInReadsFail = true;
    await renderWeightScreen();
    await screen.findByRole("button", { name: "Try again" });

    expectNothingPrivateWritten();
  });
});
