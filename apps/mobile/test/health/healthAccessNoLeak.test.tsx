import { HEALTH_ACCESS } from "@keylow/core/copy";
import { cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { AppState } from "react-native";
import { setUpTests } from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import HealthAccessRoute from "../../app/(tabs)/more/weight/health";
import { bodyNotRun, getHealthProvider } from "../../lib/health";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { createFakeHealthProvider } from "../support/fakeHealthProvider";

import type { HealthImportResult } from "../../lib/health";
import type { FakeHealthProvider } from "../support/fakeHealthProvider";
import type { NativeEventSubscription } from "react-native";

// Body fat and lean mass are health data: no value, time or sample id reaches a log, an error or the screen.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock("../../lib/health/getHealthProvider", () => ({ getHealthProvider: jest.fn() }));
const mockHealthImport = {
  importNow: jest.fn<Promise<HealthImportResult>, []>(),
  isImporting: false,
  lastImportedAt: null,
  lastResult: null,
};
jest.mock("../../lib/health/useHealthImport", () => ({
  useHealthImport: () => mockHealthImport,
}));

setUpTests();

const frame = { x: 0, y: 0, width: 390, height: 844 };
const insets = { top: 47, right: 0, bottom: 34, left: 0 };

const BODY_FAT_ID = "sample-body-fat-77";
const LEAN_MASS_ID = "sample-lean-mass-88";
const SECRETS = ["23.7", "61.2", "2026-10-21T06:41", BODY_FAT_ID, LEAN_MASS_ID];
const levels = ["log", "info", "warn", "error"] as const;

let provider: FakeHealthProvider;
let written: string[];

function importResult(inserted: number, bodyInserted: number): HealthImportResult {
  const kind = {
    status: "imported",
    read: bodyInserted,
    skipped: 0,
    inserted: bodyInserted,
  } as const;
  return {
    status: "imported",
    read: inserted,
    skipped: 0,
    inserted,
    body: bodyInserted === 0 ? bodyNotRun : { bodyFat: kind, leanMass: kind },
  };
}

async function renderRoute() {
  await render(
    <SafeAreaProvider initialMetrics={{ frame, insets }}>
      <ThemeProvider fixedPreference="dark">
        <HealthAccessRoute />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

function expectNothingPrivateShown() {
  const everything = [...written, JSON.stringify(screen.toJSON())].join("\n");
  for (const secret of SECRETS) {
    expect(everything).not.toContain(secret);
  }
}

describe("the Health access flow's output", () => {
  beforeEach(() => {
    resetRouterMock();
    provider = createFakeHealthProvider({
      bodyFatSamples: [{ sampleId: BODY_FAT_ID, measuredAt: "2026-10-21T06:41:00Z", value: 23.7 }],
      leanMassSamples: [
        {
          sampleId: LEAN_MASS_ID,
          measuredAt: "2026-10-21T06:41:00Z",
          value: 61.2,
          unit: "kilograms",
        },
      ],
    });
    jest.mocked(getHealthProvider).mockReturnValue(provider);
    mockHealthImport.importNow.mockReset();
    mockHealthImport.importNow.mockResolvedValue(importResult(5, 3));
    mockHealthImport.isImporting = false;
    jest.spyOn(AppState, "addEventListener").mockReturnValue({
      remove: jest.fn(),
    } satisfies NativeEventSubscription);
    written = [];
    for (const level of levels) {
      jest.spyOn(console, level).mockImplementation((...parts: unknown[]) => {
        written.push(
          parts
            .map((part) => {
              if (typeof part === "string") {
                return part;
              }
              // An object is written out whole, so a value nested in one is caught too.
              return part instanceof Error
                ? String(part.cause) + part.message
                : JSON.stringify(part);
            })
            .join(" "),
        );
      });
    }
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
  });

  it("should hold no body value, time or sample id from explain to connected", async () => {
    await renderRoute();
    await screen.findByRole("heading", { name: HEALTH_ACCESS.explain.heading });
    expectNothingPrivateShown();

    await userEvent.setup().press(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "5 weigh-ins imported" });

    expect(screen.getByText("Also 3 body fat and 3 lean mass readings.")).toBeOnTheScreen();
    expectNothingPrivateShown();
  });

  it("should hold none on the partial state, the add-later states and the denied ones", async () => {
    provider.state.grantBodyCompositionOnRequest = { bodyFat: false, leanMass: false };
    mockHealthImport.importNow.mockResolvedValue(importResult(5, 0));
    await renderRoute();
    await userEvent.setup().press(await screen.findByRole("button", { name: "Continue" }));
    await screen.findByText(HEALTH_ACCESS.connectedPartial.neither.text);
    expectNothingPrivateShown();

    await userEvent
      .setup()
      .press(screen.getByRole("button", { name: HEALTH_ACCESS.connectedPartial.neither.action }));
    await screen.findByRole("heading", { name: HEALTH_ACCESS.explainBodyComposition.heading });
    expectNothingPrivateShown();

    await userEvent.setup().press(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: HEALTH_ACCESS.deniedBodyComposition.heading });
    expectNothingPrivateShown();
  });

  it("should hold none when the add-later request is granted and the import runs", async () => {
    routerMock.searchParams = { add: "body-composition" };
    provider.state.permissionGranted = true;
    await renderRoute();
    await userEvent.setup().press(await screen.findByRole("button", { name: "Continue" }));
    await screen.findByText("Also 3 body fat and 3 lean mass readings.");

    expect(provider.state.bodyCompositionAccess).toEqual({ bodyFat: true, leanMass: true });
    expectNothingPrivateShown();
  });

  it("should hold none when the requests and the import fail", async () => {
    routerMock.searchParams = { add: "body-composition" };
    provider.state.permissionGranted = true;
    provider.state.failures.requestBodyCompositionPermission = "failed";
    mockHealthImport.importNow.mockResolvedValue({ ...importResult(0, 0), status: "failed" });
    await renderRoute();
    await userEvent.setup().press(await screen.findByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: HEALTH_ACCESS.deniedBodyComposition.heading });
    expectNothingPrivateShown();
  });
});
