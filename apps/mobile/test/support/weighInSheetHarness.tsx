import { KeyLowProvider } from "@keylow/api-client";
import { render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { weightClient } from "./weightBackend";
import { WeighInSheet } from "../../components/WeighInSheet";
import { ThemeProvider } from "../../lib/theme";

import type { WeighIn } from "@keylow/api-client";
import type { QueryClient } from "@tanstack/react-query";

const frame = { x: 0, y: 0, width: 390, height: 844 };
const insets = { top: 47, right: 0, bottom: 34, left: 0 };

/** 07:15 UTC on Saturday 17 October 2026 is 08:15 in London (British Summer Time), the board's own time. */
export const SHEET_NOW = new Date("2026-10-17T07:15:00Z");

/** Moves the date the sheet reads and leaves every timer running. */
export const ONLY_THE_DATE = [
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

/** A manual weigh-in of 81.4 kg at 08:15 London time on the morning of `SHEET_NOW`, noted "Before breakfast". */
export const manualWeighIn: WeighIn = {
  id: "00000000-0000-4000-8000-0000000000aa",
  measured_at: "2026-10-17T07:15:00+00:00",
  local_date: "2026-10-17",
  tz: "Europe/London",
  weight_kg: 81.4,
  source: "manual",
  note: "Before breakfast",
};

/** An imported weigh-in of 81.6 kg at 07:42 London time on the same morning. */
export const importedWeighIn: WeighIn = {
  id: "00000000-0000-4000-8000-0000000000bb",
  measured_at: "2026-10-17T06:42:00+00:00",
  local_date: "2026-10-17",
  tz: "Europe/London",
  weight_kg: 81.6,
  source: "health_connect",
  note: null,
};

/**
 * The sheet, open, over the real hooks and the fake database. Without a weigh-in it adds one, with one it
 * opens it. It waits for Date and Time to read the profile's zone, unless the test holds the zone back and
 * asks not to wait.
 */
export async function renderWeighInSheet(
  queryClient: QueryClient,
  { waitsForZone = true, weighIn }: { waitsForZone?: boolean; weighIn?: WeighIn } = {},
) {
  const onClose = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={{ frame, insets }}>
      <ThemeProvider fixedPreference="dark">
        <KeyLowProvider client={weightClient} queryClient={queryClient}>
          <WeighInSheet open weighIn={weighIn} onClose={onClose} />
        </KeyLowProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  if (waitsForZone) {
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Time\s*\d\d:\d\d/ })).toBeOnTheScreen();
    });
  }
  return { onClose, user: userEvent.setup() };
}
