import {
  HEALTH_ACCESS,
  HEALTH_ACCESS_BODY_POINTS,
  HEALTH_ACCESS_EXPLAIN_POINTS,
  LEGAL_URLS,
} from "@keylow/core/copy";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { AppState, Linking } from "react-native";
import { setUpTests } from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import HealthAccessRoute from "../../app/(tabs)/more/weight/health";
import { bodyNotRun, getHealthProvider } from "../../lib/health";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { createFakeHealthProvider } from "../support/fakeHealthProvider";

import type { HealthImportResult } from "../../lib/health";
import type { FakeHealthProvider } from "../support/fakeHealthProvider";
import type { AppStateStatus, NativeEventSubscription } from "react-native";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock("../../lib/health/getHealthProvider", () => ({ getHealthProvider: jest.fn() }));
// The shared import state is set directly here, and `importNow` is a fake the test scripts.
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

const imported = (inserted: number): HealthImportResult => ({
  status: "imported",
  read: inserted,
  skipped: 0,
  inserted,
  body: bodyNotRun,
});
// An import that read body composition too: the weight count, then each body kind's stored rows.
const importedWithBody = (
  inserted: number,
  bodyFatInserted: number,
  leanMassInserted: number,
): HealthImportResult => ({
  ...imported(inserted),
  body: {
    bodyFat: { status: "imported", read: bodyFatInserted, skipped: 0, inserted: bodyFatInserted },
    leanMass: {
      status: "imported",
      read: leanMassInserted,
      skipped: 0,
      inserted: leanMassInserted,
    },
  },
});
const withStatus = (status: HealthImportResult["status"]): HealthImportResult => ({
  status,
  read: 0,
  skipped: 0,
  inserted: 0,
  body: bodyNotRun,
});

let provider: FakeHealthProvider;
let foregroundListeners: ((state: AppStateStatus) => void)[];
const user = () => userEvent.setup();

async function renderRoute() {
  await render(
    <SafeAreaProvider initialMetrics={{ frame, insets }}>
      <ThemeProvider fixedPreference="dark">
        <HealthAccessRoute />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

const addBodyComposition = { add: "body-composition" };
const bodyFatOnly = { bodyFat: true, leanMass: false };
const leanMassOnly = { bodyFat: false, leanMass: true };

const names = (method: FakeHealthProvider["calls"][number]["method"]) =>
  provider.calls.filter((call) => call.method === method);

// The header's X is named Close too, so the footer's Close is the second.
function footerClose() {
  const button = screen.getAllByRole("button", { name: "Close" })[1];
  if (button === undefined) {
    throw new Error("The screen has no footer Close button");
  }
  return button;
}

describe("the Health access route", () => {
  beforeEach(() => {
    resetRouterMock();
    provider = createFakeHealthProvider();
    jest.mocked(getHealthProvider).mockReturnValue(provider);
    mockHealthImport.importNow.mockReset();
    mockHealthImport.importNow.mockResolvedValue(imported(5));
    mockHealthImport.isImporting = false;
    foregroundListeners = [];
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_type, listener): NativeEventSubscription => {
        foregroundListeners.push(listener);
        return { remove: jest.fn() };
      });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
  });

  describe("where Health Connect is not offered", () => {
    it("should replace itself with the Weight screen when there is no provider", async () => {
      jest.mocked(getHealthProvider).mockReturnValue(null);

      await renderRoute();

      expect(routerMock.redirect).toHaveBeenCalledWith("/more/weight");
      expect(screen.queryByRole("heading")).not.toBeOnTheScreen();
    });

    it("should replace itself with the Weight screen when Health Connect is unsupported", async () => {
      provider.state.availability = "unsupported";

      await renderRoute();

      await waitFor(() => {
        expect(routerMock.redirect).toHaveBeenCalledWith("/more/weight");
      });
      expect(screen.queryByRole("heading")).not.toBeOnTheScreen();
    });
  });

  it("should present itself as a modal over the Weight screen", async () => {
    await renderRoute();

    expect(routerMock.screenOptions).toContainEqual(
      expect.objectContaining({ presentation: "modal" }),
    );
  });

  describe("when the body composition access cannot be read", () => {
    beforeEach(() => {
      jest.spyOn(provider, "bodyCompositionAccess").mockRejectedValue(new Error("x"));
    });

    it("should still reach explain in the first-time flow", async () => {
      await renderRoute();

      expect(
        await screen.findByRole("heading", { name: HEALTH_ACCESS.explain.heading }),
      ).toBeOnTheScreen();
    });

    it("should still reach explain · body-composition, and ask, in the add-later flow", async () => {
      routerMock.searchParams = addBodyComposition;
      provider.state.permissionGranted = true;
      provider.state.grantBodyCompositionOnRequest = { bodyFat: false, leanMass: false };
      await renderRoute();

      expect(
        await screen.findByRole("heading", { name: HEALTH_ACCESS.explainBodyComposition.heading }),
      ).toBeOnTheScreen();
      await user().press(screen.getByRole("button", { name: "Continue" }));

      expect(
        await screen.findByRole("heading", { name: HEALTH_ACCESS.deniedBodyComposition.heading }),
      ).toBeOnTheScreen();
      expect(names("requestBodyCompositionPermission")).toHaveLength(1);
    });
  });

  describe("install", () => {
    beforeEach(() => {
      provider.state.availability = "needs-install";
    });

    it("should show the install state and open the install page once from Get Health Connect", async () => {
      await renderRoute();

      expect(
        await screen.findByRole("heading", { name: HEALTH_ACCESS.install.heading }),
      ).toBeOnTheScreen();
      await user().press(screen.getByRole("button", { name: "Get Health Connect" }));

      expect(names("openInstallPage")).toHaveLength(1);
    });

    it("should check again on returning to the foreground and move to explain once installed", async () => {
      await renderRoute();
      await screen.findByRole("heading", { name: HEALTH_ACCESS.install.heading });
      provider.state.availability = "available";

      await act(() => {
        foregroundListeners.forEach((listener) => {
          listener("active");
        });
      });

      expect(
        await screen.findByRole("heading", { name: HEALTH_ACCESS.explain.heading }),
      ).toBeOnTheScreen();
    });
  });

  describe("explain to connected", () => {
    it("should ask for permission once, import once and show the count with See your trend", async () => {
      await renderRoute();
      await user().press(await screen.findByRole("button", { name: "Continue" }));

      expect(
        await screen.findByRole("heading", { name: "5 weigh-ins imported" }),
      ).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "See your trend" })).toBeOnTheScreen();
      expect(names("requestPermission")).toHaveLength(1);
      expect(mockHealthImport.importNow).toHaveBeenCalledTimes(1);
    });

    it("should ask for weight, body fat and lean mass in one request", async () => {
      await renderRoute();
      await user().press(await screen.findByRole("button", { name: "Continue" }));
      await screen.findByRole("heading", { name: "5 weigh-ins imported" });

      expect(names("requestPermission")).toEqual([
        { method: "requestPermission", includeBodyComposition: true },
      ]);
      expect(names("requestBodyCompositionPermission")).toHaveLength(0);
    });

    it("should read zero for a repeat import that stored nothing", async () => {
      mockHealthImport.importNow.mockResolvedValue(imported(0));
      await renderRoute();
      await user().press(await screen.findByRole("button", { name: "Continue" }));

      expect(
        await screen.findByRole("heading", { name: "0 weigh-ins imported" }),
      ).toBeOnTheScreen();
    });

    it("should read zero for nothing-new too", async () => {
      mockHealthImport.importNow.mockResolvedValue(withStatus("nothing-new"));
      await renderRoute();
      await user().press(await screen.findByRole("button", { name: "Continue" }));

      expect(
        await screen.findByRole("heading", { name: "0 weigh-ins imported" }),
      ).toBeOnTheScreen();
    });

    it("should show connecting, with a disabled Importing button, while the import runs", async () => {
      let finish: (result: HealthImportResult) => void = () => undefined;
      mockHealthImport.importNow.mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
      await renderRoute();
      await user().press(await screen.findByRole("button", { name: "Continue" }));

      expect(await screen.findByRole("button", { name: "Importing" })).toBeDisabled();

      await act(() => {
        finish(imported(3));
      });

      expect(
        await screen.findByRole("heading", { name: "3 weigh-ins imported" }),
      ).toBeOnTheScreen();
    });

    it("should return to the Weight screen from See your trend", async () => {
      await renderRoute();
      await user().press(await screen.findByRole("button", { name: "Continue" }));
      await user().press(await screen.findByRole("button", { name: "See your trend" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should ask for nothing but permission and read no weight itself", async () => {
      await renderRoute();
      await user().press(await screen.findByRole("button", { name: "Continue" }));
      await screen.findByRole("heading", { name: "5 weigh-ins imported" });

      expect(names("readWeightSince")).toHaveLength(0);
    });
  });

  describe("denied", () => {
    it("should show denied with its steps when the request is denied, and open settings from Open Health Connect", async () => {
      provider.state.grantOnRequest = false;
      await renderRoute();
      await user().press(await screen.findByRole("button", { name: "Continue" }));

      expect(
        await screen.findByRole("heading", { name: HEALTH_ACCESS.denied.heading }),
      ).toBeOnTheScreen();
      HEALTH_ACCESS.denied.steps.forEach((step) => {
        expect(screen.getByText(step)).toBeOnTheScreen();
      });
      expect(mockHealthImport.importNow).not.toHaveBeenCalled();

      await user().press(screen.getByRole("button", { name: "Open Health Connect" }));

      expect(names("openSettings")).toHaveLength(1);
    });

    it("should show denied when the import finds that access was taken away", async () => {
      mockHealthImport.importNow.mockResolvedValue(withStatus("no-permission"));
      await renderRoute();
      await user().press(await screen.findByRole("button", { name: "Continue" }));

      expect(
        await screen.findByRole("heading", { name: HEALTH_ACCESS.denied.heading }),
      ).toBeOnTheScreen();
    });
  });

  describe("import-error", () => {
    it.each(["failed", "unavailable"] as const)(
      "should show the alert body when the import is %s, and import again from Try again",
      async (status) => {
        mockHealthImport.importNow
          .mockResolvedValueOnce(withStatus(status))
          .mockResolvedValueOnce(imported(2));
        await renderRoute();
        await user().press(await screen.findByRole("button", { name: "Continue" }));

        expect(await screen.findByRole("alert")).toHaveTextContent(HEALTH_ACCESS.importError.body);

        await user().press(screen.getByRole("button", { name: "Try again" }));

        expect(
          await screen.findByRole("heading", { name: "2 weigh-ins imported" }),
        ).toBeOnTheScreen();
        expect(mockHealthImport.importNow).toHaveBeenCalledTimes(2);
        expect(names("requestPermission")).toHaveLength(1);
      },
    );

    it("should return to the Weight screen from the footer Close", async () => {
      mockHealthImport.importNow.mockResolvedValue(withStatus("failed"));
      await renderRoute();
      await user().press(await screen.findByRole("button", { name: "Continue" }));
      await screen.findByRole("alert");

      await user().press(footerClose());

      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });
  });

  describe("opening while an import is running", () => {
    it("should show connecting and join the running import instead of starting another", async () => {
      let finish: (result: HealthImportResult) => void = () => undefined;
      mockHealthImport.importNow.mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
      provider.state.permissionGranted = true;
      mockHealthImport.isImporting = true;
      await renderRoute();

      expect(await screen.findByRole("button", { name: "Importing" })).toBeDisabled();
      expect(mockHealthImport.importNow).toHaveBeenCalledTimes(1);

      await act(() => {
        finish(imported(5));
      });

      expect(
        await screen.findByRole("heading", { name: "5 weigh-ins imported" }),
      ).toBeOnTheScreen();
      expect(mockHealthImport.importNow).toHaveBeenCalledTimes(1);
      expect(names("requestPermission")).toHaveLength(0);
    });

    it("should show explain, and start nothing, when permission is held and no import is running", async () => {
      provider.state.permissionGranted = true;
      await renderRoute();

      expect(
        await screen.findByRole("heading", { name: HEALTH_ACCESS.explain.heading }),
      ).toBeOnTheScreen();
      expect(mockHealthImport.importNow).not.toHaveBeenCalled();
    });
  });

  describe("when the provider throws", () => {
    it("should show denied when requestPermission rejects, and Continue works again once permission is held", async () => {
      provider.state.failures.requestPermission = "failed";
      await renderRoute();
      await user().press(await screen.findByRole("button", { name: "Continue" }));

      expect(
        await screen.findByRole("heading", { name: HEALTH_ACCESS.denied.heading }),
      ).toBeOnTheScreen();

      delete provider.state.failures.requestPermission;
      provider.state.permissionGranted = true;
      await act(() => {
        foregroundListeners.forEach((listener) => {
          listener("active");
        });
      });
      await user().press(await screen.findByRole("button", { name: "Continue" }));

      expect(
        await screen.findByRole("heading", { name: "5 weigh-ins imported" }),
      ).toBeOnTheScreen();
      expect(names("requestPermission")).toHaveLength(2);
    });

    it("should show explain when hasPermission rejects", async () => {
      provider.state.failures.hasPermission = "failed";
      await renderRoute();

      expect(
        await screen.findByRole("heading", { name: HEALTH_ACCESS.explain.heading }),
      ).toBeOnTheScreen();
    });

    it("should replace itself with the Weight screen when availability rejects", async () => {
      provider.availability = () => Promise.reject(new Error("unavailable"));
      await renderRoute();

      await waitFor(() => {
        expect(routerMock.redirect).toHaveBeenCalledWith("/more/weight");
      });
    });
  });

  describe("after permission changes outside the flow", () => {
    it("should leave denied once permission is granted in settings and the app returns", async () => {
      provider.state.grantOnRequest = false;
      await renderRoute();
      await user().press(await screen.findByRole("button", { name: "Continue" }));
      await screen.findByRole("heading", { name: HEALTH_ACCESS.denied.heading });

      provider.state.permissionGranted = true;
      await act(() => {
        foregroundListeners.forEach((listener) => {
          listener("active");
        });
      });

      await waitFor(() => {
        expect(
          screen.queryByRole("heading", { name: HEALTH_ACCESS.denied.heading }),
        ).not.toBeOnTheScreen();
      });
      expect(
        screen.getByRole("heading", { name: HEALTH_ACCESS.explain.heading }),
      ).toBeOnTheScreen();
    });

    it("should keep the joined import's count when the permission request resolves after it", async () => {
      let finishImport: (value: HealthImportResult) => void = () => undefined;
      mockHealthImport.importNow.mockReturnValue(
        new Promise((resolve) => {
          finishImport = resolve;
        }),
      );
      let grant: () => void = () => undefined;
      provider.requestPermission = () =>
        new Promise((resolve) => {
          grant = () => {
            resolve("granted");
          };
        });
      await renderRoute();
      // Continue opens the system sheet, which has not answered yet.
      await user().press(await screen.findByRole("button", { name: "Continue" }));
      // Permission is granted there and the app returns, as the runner's own import starts.
      provider.state.permissionGranted = true;
      mockHealthImport.isImporting = true;
      await act(() => {
        foregroundListeners.forEach((listener) => {
          listener("active");
        });
      });
      await waitFor(() => {
        expect(mockHealthImport.importNow).toHaveBeenCalledTimes(1);
      });

      await act(() => {
        finishImport(imported(64));
      });
      expect(
        await screen.findByRole("heading", { name: "64 weigh-ins imported" }),
      ).toBeOnTheScreen();

      await act(() => {
        grant();
      });

      expect(screen.getByRole("heading", { name: "64 weigh-ins imported" })).toBeOnTheScreen();
      expect(mockHealthImport.importNow).toHaveBeenCalledTimes(1);
    });
  });

  describe("the points and the optional caption of explain", () => {
    it("should say the body types are optional under the four rewritten points", async () => {
      await renderRoute();

      expect(await screen.findByText(HEALTH_ACCESS.explainOptionalNote)).toBeOnTheScreen();
      HEALTH_ACCESS_EXPLAIN_POINTS.forEach((point) => {
        expect(screen.getByText(point.text)).toBeOnTheScreen();
      });
    });
  });

  describe("the first-time flow with body composition", () => {
    beforeEach(() => {
      mockHealthImport.importNow.mockResolvedValue(importedWithBody(64, 12, 12));
    });

    it("should show the counts line on connected when both kinds came in", async () => {
      await renderRoute();
      await user().press(await screen.findByRole("button", { name: "Continue" }));

      expect(
        await screen.findByRole("heading", { name: "64 weigh-ins imported" }),
      ).toBeOnTheScreen();
      expect(screen.getByText("Also 12 body fat and 12 lean mass readings.")).toBeOnTheScreen();
      expect(
        screen.queryByRole("button", { name: HEALTH_ACCESS.connectedPartial.neither.action }),
      ).not.toBeOnTheScreen();
    });

    it("should show no counts line when no body reading came in", async () => {
      mockHealthImport.importNow.mockResolvedValue(importedWithBody(64, 0, 0));
      await renderRoute();
      await user().press(await screen.findByRole("button", { name: "Continue" }));
      await screen.findByRole("heading", { name: "64 weigh-ins imported" });

      expect(screen.queryByText(/^Also /)).not.toBeOnTheScreen();
    });

    it("should say body composition is being read while it imports, with both types allowed", async () => {
      mockHealthImport.importNow.mockReturnValue(new Promise(() => undefined));
      await renderRoute();
      await user().press(await screen.findByRole("button", { name: "Continue" }));

      expect(await screen.findByRole("button", { name: "Importing" })).toBeDisabled();
      expect(screen.getByText(HEALTH_ACCESS.connecting.bodyWithBodyComposition)).toBeOnTheScreen();
    });

    it("should keep the weight-only words while it imports, with neither type allowed", async () => {
      provider.state.grantBodyCompositionOnRequest = { bodyFat: false, leanMass: false };
      mockHealthImport.importNow.mockReturnValue(new Promise(() => undefined));
      await renderRoute();
      await user().press(await screen.findByRole("button", { name: "Continue" }));

      expect(await screen.findByRole("button", { name: "Importing" })).toBeDisabled();
      expect(
        screen.getByText("Reading your weight history. This only happens while Ki-Lo is open."),
      ).toBeOnTheScreen();
    });

    it.each([
      ["neither type", { bodyFat: false, leanMass: false }, "neither"],
      ["body fat alone", bodyFatOnly, "leanMassMissing"],
      ["lean mass alone", leanMassOnly, "bodyFatMissing"],
    ] as const)(
      "should end on connected · partial, with its own sentence and action, when %s is allowed",
      async (_name, granted, missing) => {
        provider.state.grantBodyCompositionOnRequest = granted;
        mockHealthImport.importNow.mockResolvedValue(imported(64));
        await renderRoute();
        await user().press(await screen.findByRole("button", { name: "Continue" }));

        expect(
          await screen.findByRole("heading", { name: "64 weigh-ins imported" }),
        ).toBeOnTheScreen();
        expect(screen.getByText(HEALTH_ACCESS.connectedPartial[missing].text)).toBeOnTheScreen();
        expect(
          screen.getByRole("button", { name: HEALTH_ACCESS.connectedPartial[missing].action }),
        ).toBeOnTheScreen();
        expect(screen.getByRole("button", { name: "See your trend" })).toBeOnTheScreen();
      },
    );

    it("should show denied when weight is refused, whatever the body types answered", async () => {
      provider.state.grantOnRequest = false;
      provider.state.bodyCompositionAccess = { bodyFat: true, leanMass: true };
      await renderRoute();
      await user().press(await screen.findByRole("button", { name: "Continue" }));

      expect(
        await screen.findByRole("heading", { name: HEALTH_ACCESS.denied.heading }),
      ).toBeOnTheScreen();
      expect(mockHealthImport.importNow).not.toHaveBeenCalled();
    });

    it("should show denied when the import finds weight access gone, whatever the body result says", async () => {
      mockHealthImport.importNow.mockResolvedValue({
        ...importedWithBody(0, 3, 3),
        status: "no-permission",
      });
      await renderRoute();
      await user().press(await screen.findByRole("button", { name: "Continue" }));

      expect(
        await screen.findByRole("heading", { name: HEALTH_ACCESS.denied.heading }),
      ).toBeOnTheScreen();
    });
  });

  describe("the add-later flow", () => {
    beforeEach(() => {
      routerMock.searchParams = addBodyComposition;
      provider.state.permissionGranted = true;
      mockHealthImport.importNow.mockResolvedValue(importedWithBody(0, 12, 12));
    });

    it("should show explain · body-composition with its two points and the privacy link, but no caption", async () => {
      await renderRoute();

      expect(
        await screen.findByRole("heading", { name: HEALTH_ACCESS.explainBodyComposition.heading }),
      ).toBeOnTheScreen();
      expect(screen.getByText(HEALTH_ACCESS.explainBodyComposition.body)).toBeOnTheScreen();
      HEALTH_ACCESS_BODY_POINTS.forEach((point) => {
        expect(screen.getByText(point.title)).toBeOnTheScreen();
        expect(screen.getByText(point.text)).toBeOnTheScreen();
      });
      expect(screen.queryByText(HEALTH_ACCESS.explainOptionalNote)).not.toBeOnTheScreen();
      expect(screen.getByRole("link", { name: HEALTH_ACCESS.privacyPolicyLink })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Continue" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Not now" })).toBeOnTheScreen();
    });

    it("should ask for the two body types only, never weight, and import once", async () => {
      await renderRoute();
      await user().press(await screen.findByRole("button", { name: "Continue" }));

      expect(
        await screen.findByRole("heading", { name: "0 weigh-ins imported" }),
      ).toBeOnTheScreen();
      expect(screen.getByText("Also 12 body fat and 12 lean mass readings.")).toBeOnTheScreen();
      expect(names("requestBodyCompositionPermission")).toHaveLength(1);
      expect(names("requestPermission")).toHaveLength(0);
      expect(mockHealthImport.importNow).toHaveBeenCalledTimes(1);
    });

    it("should show connecting with the body composition words while it imports", async () => {
      mockHealthImport.importNow.mockReturnValue(new Promise(() => undefined));
      await renderRoute();
      await user().press(await screen.findByRole("button", { name: "Continue" }));

      expect(await screen.findByRole("button", { name: "Importing" })).toBeDisabled();
      expect(screen.getByText(HEALTH_ACCESS.connecting.bodyWithBodyComposition)).toBeOnTheScreen();
    });

    it("should end on connected · partial when one type was granted", async () => {
      provider.state.grantBodyCompositionOnRequest = leanMassOnly;
      mockHealthImport.importNow.mockResolvedValue(importedWithBody(0, 0, 4));
      await renderRoute();
      await user().press(await screen.findByRole("button", { name: "Continue" }));

      expect(await screen.findByText("Also 4 lean mass readings.")).toBeOnTheScreen();
      expect(
        screen.getByText(HEALTH_ACCESS.connectedPartial.bodyFatMissing.text),
      ).toBeOnTheScreen();
    });

    it("should show denied · body-composition, and import nothing, when neither type was granted", async () => {
      provider.state.grantBodyCompositionOnRequest = { bodyFat: false, leanMass: false };
      await renderRoute();
      await user().press(await screen.findByRole("button", { name: "Continue" }));

      expect(
        await screen.findByRole("heading", { name: HEALTH_ACCESS.deniedBodyComposition.heading }),
      ).toBeOnTheScreen();
      expect(screen.getByText(HEALTH_ACCESS.deniedBodyComposition.body)).toBeOnTheScreen();
      HEALTH_ACCESS.deniedBodyComposition.steps.forEach((step) => {
        expect(screen.getByText(step)).toBeOnTheScreen();
      });
      expect(mockHealthImport.importNow).not.toHaveBeenCalled();

      await user().press(screen.getByRole("button", { name: "Open Health Connect" }));

      expect(names("openSettings")).toHaveLength(1);
    });

    it("should import, and not show explain again, once a type is turned on in Health Connect", async () => {
      provider.state.grantBodyCompositionOnRequest = { bodyFat: false, leanMass: false };
      await renderRoute();
      await user().press(await screen.findByRole("button", { name: "Continue" }));
      await screen.findByRole("heading", { name: HEALTH_ACCESS.deniedBodyComposition.heading });

      provider.state.bodyCompositionAccess = { bodyFat: true, leanMass: true };
      await act(() => {
        foregroundListeners.forEach((listener) => {
          listener("active");
        });
      });

      expect(
        await screen.findByRole("heading", { name: "0 weigh-ins imported" }),
      ).toBeOnTheScreen();
      expect(
        screen.queryByRole("heading", { name: HEALTH_ACCESS.explainBodyComposition.heading }),
      ).not.toBeOnTheScreen();
      expect(mockHealthImport.importNow).toHaveBeenCalledTimes(1);
      expect(names("requestPermission")).toHaveLength(0);
    });

    it("should not join an import that is already running before anything is asked", async () => {
      mockHealthImport.isImporting = true;
      await renderRoute();

      expect(
        await screen.findByRole("heading", { name: HEALTH_ACCESS.explainBodyComposition.heading }),
      ).toBeOnTheScreen();
      expect(mockHealthImport.importNow).not.toHaveBeenCalled();
    });

    it("should leave from Not now and from Close", async () => {
      await renderRoute();
      await user().press(await screen.findByRole("button", { name: "Not now" }));
      await user().press(screen.getByRole("button", { name: "Close" }));

      expect(routerMock.back).toHaveBeenCalledTimes(2);
    });

    it("should stay on connecting while the first import runs when weight was not held on opening", async () => {
      provider.state.permissionGranted = false;
      mockHealthImport.importNow.mockReturnValue(new Promise(() => undefined));
      await renderRoute();
      await user().press(await screen.findByRole("button", { name: "Continue" }));

      expect(await screen.findByRole("button", { name: "Importing" })).toBeDisabled();
      expect(
        screen.queryByRole("heading", { name: HEALTH_ACCESS.explainBodyComposition.heading }),
      ).not.toBeOnTheScreen();
      expect(names("requestBodyCompositionPermission")).toHaveLength(0);
    });

    it("should ask for the body types once when Continue is pressed twice before the sheet answers", async () => {
      const request = jest
        .spyOn(provider, "requestBodyCompositionPermission")
        .mockReturnValue(new Promise(() => undefined));
      await renderRoute();
      const continueButton = await screen.findByRole("button", { name: "Continue" });
      await user().press(continueButton);
      await user().press(continueButton);

      expect(request).toHaveBeenCalledTimes(1);
    });

    it("should run the first-time flow when weight permission is not held", async () => {
      provider.state.permissionGranted = false;
      await renderRoute();

      expect(
        await screen.findByRole("heading", { name: HEALTH_ACCESS.explain.heading }),
      ).toBeOnTheScreen();
      await user().press(screen.getByRole("button", { name: "Continue" }));
      await screen.findByRole("heading", { name: /weigh-ins? imported/ });

      expect(names("requestPermission")).toEqual([
        { method: "requestPermission", includeBodyComposition: true },
      ]);
      expect(names("requestBodyCompositionPermission")).toHaveLength(0);
    });

    it.each([{ add: "weight" }, { add: ["body-composition", "weight"] }, { add: "" }, {}])(
      "should run the first-time flow for the parameter %j",
      async (searchParams) => {
        routerMock.searchParams = searchParams;
        await renderRoute();

        expect(
          await screen.findByRole("heading", { name: HEALTH_ACCESS.explain.heading }),
        ).toBeOnTheScreen();
        await user().press(screen.getByRole("button", { name: "Continue" }));
        await screen.findByRole("heading", { name: /weigh-ins? imported/ });

        expect(names("requestPermission")).toHaveLength(1);
        expect(names("requestBodyCompositionPermission")).toHaveLength(0);
      },
    );
  });

  describe("connected · partial", () => {
    async function renderPartial() {
      provider.state.grantBodyCompositionOnRequest = bodyFatOnly;
      mockHealthImport.importNow.mockResolvedValue(importedWithBody(64, 3, 0));
      await renderRoute();
      await user().press(await screen.findByRole("button", { name: "Continue" }));
      await screen.findByRole("heading", { name: "64 weigh-ins imported" });
    }

    it("should move the same screen to explain · body-composition from its action, without closing", async () => {
      await renderPartial();
      await user().press(
        screen.getByRole("button", { name: HEALTH_ACCESS.connectedPartial.leanMassMissing.action }),
      );

      expect(
        await screen.findByRole("heading", { name: HEALTH_ACCESS.explainBodyComposition.heading }),
      ).toBeOnTheScreen();
      expect(routerMock.back).not.toHaveBeenCalled();
      expect(routerMock.replace).not.toHaveBeenCalled();
    });

    it("should ask for the body types only, never weight again, and import again from there", async () => {
      await renderPartial();
      provider.state.grantBodyCompositionOnRequest = { bodyFat: true, leanMass: true };
      mockHealthImport.importNow.mockResolvedValue(importedWithBody(0, 0, 6));
      await user().press(
        screen.getByRole("button", { name: HEALTH_ACCESS.connectedPartial.leanMassMissing.action }),
      );
      await user().press(await screen.findByRole("button", { name: "Continue" }));

      expect(await screen.findByText("Also 6 lean mass readings.")).toBeOnTheScreen();
      expect(names("requestPermission")).toHaveLength(1);
      expect(names("requestBodyCompositionPermission")).toHaveLength(1);
      expect(mockHealthImport.importNow).toHaveBeenCalledTimes(2);
      expect(
        screen.queryByRole("button", {
          name: HEALTH_ACCESS.connectedPartial.leanMassMissing.action,
        }),
      ).not.toBeOnTheScreen();
    });

    it("should leave from See your trend and from Close", async () => {
      await renderPartial();
      await user().press(screen.getByRole("button", { name: "See your trend" }));
      await user().press(screen.getByRole("button", { name: "Close" }));

      expect(routerMock.back).toHaveBeenCalledTimes(2);
    });

    it("should leave from Not now on the explain screen it opens", async () => {
      await renderPartial();
      await user().press(
        screen.getByRole("button", { name: HEALTH_ACCESS.connectedPartial.leanMassMissing.action }),
      );
      await user().press(await screen.findByRole("button", { name: "Not now" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });
  });

  describe("closing", () => {
    it("should go back from the Close button and Not now", async () => {
      await renderRoute();
      await user().press(await screen.findByRole("button", { name: "Close" }));
      await user().press(screen.getByRole("button", { name: "Not now" }));

      expect(routerMock.back).toHaveBeenCalledTimes(2);
    });

    it("should replace itself with the Weight screen when a link opened it cold", async () => {
      routerMock.canGoBack.mockReturnValue(false);
      await renderRoute();
      await user().press(await screen.findByRole("button", { name: "Close" }));

      expect(routerMock.replace).toHaveBeenCalledWith("/more/weight");
      expect(routerMock.back).not.toHaveBeenCalled();
    });
  });

  it("should open the privacy policy in the browser", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    await renderRoute();
    await user().press(await screen.findByRole("link", { name: HEALTH_ACCESS.privacyPolicyLink }));

    expect(openURL).toHaveBeenCalledWith(LEGAL_URLS.privacy);
  });
});
