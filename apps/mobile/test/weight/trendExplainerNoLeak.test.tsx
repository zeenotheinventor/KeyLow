import { KeyLowProvider } from "@keylow/api-client";
import { cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import TrendExplainerRoute from "../../app/(tabs)/more/weight/explainer";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock } from "../support/expoRouterMock";
import {
  createWeightQueryClient,
  resetWeightBackend,
  weightBackend,
  weightClient,
  weighInRow,
} from "../support/weightBackend";

import type { QueryClient } from "@tanstack/react-query";

// Weigh-ins are health data: no weight, note or date reaches a log or an error, whether the explainer reads
// them or the read fails.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock("@gorhom/bottom-sheet", () =>
  jest
    .requireActual<{ mockBottomSheet: () => unknown }>("../support/sheetScrollViewMock")
    .mockBottomSheet(),
);

setUpTests();

const levels = ["log", "info", "warn", "error"] as const;
const NOTE = "after the long run, felt heavy";

let written: string[];
let queryClient: QueryClient;

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

async function renderRoute() {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, right: 0, bottom: 34, left: 0 },
      }}
    >
      <ThemeProvider fixedPreference="dark">
        <KeyLowProvider client={weightClient} queryClient={queryClient}>
          <TrendExplainerRoute />
        </KeyLowProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

function expectNothingPrivateWritten() {
  const text = written.join("\n");
  for (const secret of ["99.4", "81.6", NOTE, "2026-10-17"]) {
    expect(text).not.toContain(secret);
  }
}

describe("the trend explainer's console output and errors", () => {
  beforeEach(() => {
    resetRouterMock();
    resetWeightBackend();
    queryClient = createWeightQueryClient();
    spyOnConsole();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
    queryClient.clear();
  });

  it("should write no weight, note or date while it settles and closes", async () => {
    const user = userEvent.setup();
    weightBackend.weighIns = [
      weighInRow({ localDate: "2026-10-17", utcTime: "07:30", weightKg: 99.4, note: NOTE }),
      weighInRow({ localDate: "2026-10-16", utcTime: "07:30", weightKg: 81.6 }),
    ];
    await renderRoute();

    await screen.findByRole("note", { name: "Your trend is settling: 2 of 7 weigh-ins" });
    await user.press(screen.getByRole("button", { name: "Done" }));

    expectNothingPrivateWritten();
  });

  it("should write no raw database text when the weigh-ins cannot be read", async () => {
    weightBackend.weighInReadsFail = true;
    await renderRoute();

    await screen.findByRole("heading", { name: "Why a trend" });

    expectNothingPrivateWritten();
    expect(written.join("\n")).not.toContain("raw database text");
  });
});
