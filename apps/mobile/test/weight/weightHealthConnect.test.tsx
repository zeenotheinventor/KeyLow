import "../support/gestureHandler";
import "../support/sentryMock";

import { KeyLowProvider } from "@keylow/api-client";
import { captureException } from "@sentry/react-native";
import { act, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { isValidElement } from "react";

import { WeightScreen } from "../../components/WeightScreen";
import { bodyNotRun, getHealthProvider } from "../../lib/health";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { fakeHealthImport } from "../support/fakeHealthImport";
import { createFakeHealthProvider } from "../support/fakeHealthProvider";
import {
  createWeightQueryClient,
  resetWeightBackend,
  weightBackend,
  weightClient,
  weighInRow,
} from "../support/weightBackend";

import type { HealthImportResult } from "../../lib/health";
import type { FakeHealthProvider } from "../support/fakeHealthProvider";

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
jest.mock("../../lib/health/getHealthProvider", () => ({ getHealthProvider: jest.fn() }));
jest.mock("../../lib/health/useHealthImport", () => ({
  useHealthImport: jest.requireActual<typeof import("../support/fakeHealthImport")>(
    "../support/fakeHealthImport",
  ).useFakeHealthImport,
}));

const levels = ["log", "info", "warn", "error"] as const;
const result = (status: HealthImportResult["status"], inserted = 0): HealthImportResult => ({
  status,
  read: inserted,
  skipped: 0,
  inserted,
  body: bodyNotRun,
});

let provider: FakeHealthProvider;

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

// The list is named for what it holds, and the refresh control is a prop of the scroll view that carries it.
function refreshControlProps() {
  const control: unknown = screen.getByLabelText("Weigh-ins").props.refreshControl;

  if (!isValidElement<{ onRefresh: () => void; refreshing: boolean }>(control)) {
    throw new Error("The list has no refresh control");
  }
  return control.props;
}

/** What a pull down does: the list's refresh control is asked to refresh. */
async function pull() {
  await act(() => {
    refreshControlProps().onRefresh();
  });
}

const isRefreshing = () => refreshControlProps().refreshing;

describe("the Weight screen and Health Connect", () => {
  beforeEach(() => {
    resetRouterMock();
    resetWeightBackend();
    fakeHealthImport.reset();
    provider = createFakeHealthProvider();
    jest.mocked(getHealthProvider).mockReturnValue(provider);
    weightBackend.weighIns = [
      weighInRow({ localDate: "2026-10-20", utcTime: "07:30", weightKg: 81.6 }),
    ];
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  describe("the status beside the heading", () => {
    it("should give the last import line when connected", async () => {
      provider.state.permissionGranted = true;
      fakeHealthImport.set({ lastImportedAt: new Date(Date.now() - 125_000).toISOString() });
      await renderWeightScreen();

      expect(await screen.findByText("Health Connect · updated 2 min ago")).toBeOnTheScreen();
    });

    it("should say it is checking, under an importing line, while an import runs", async () => {
      provider.state.permissionGranted = true;
      await renderWeightScreen();

      await act(() => {
        fakeHealthImport.set({ isImporting: true });
      });

      expect(
        screen.getByRole("status", { name: "Importing from Health Connect" }),
      ).toBeOnTheScreen();
      expect(screen.getByText("Checking for new readings")).toBeOnTheScreen();
    });

    it("should draw no importing line when no import runs", async () => {
      await renderWeightScreen();

      expect(screen.queryByText("Importing from Health Connect")).not.toBeOnTheScreen();
    });

    it("should offer a Connect Health Connect link that opens the flow when not connected", async () => {
      const user = userEvent.setup();
      await renderWeightScreen();

      await user.press(await screen.findByRole("link", { name: "Connect Health Connect" }));

      expect(routerMock.push).toHaveBeenCalledWith("/more/weight/health");
    });

    it("should draw no link once connected", async () => {
      provider.state.permissionGranted = true;
      fakeHealthImport.set({ lastImportedAt: new Date(Date.now() - 125_000).toISOString() });
      await renderWeightScreen();
      // The last import line is the sign that the connection has been read as connected.
      await screen.findByText("Health Connect · updated 2 min ago");

      expect(screen.queryByRole("link", { name: "Connect Health Connect" })).not.toBeOnTheScreen();
    });

    it("should draw nothing where there is no Health Connect", async () => {
      jest.mocked(getHealthProvider).mockReturnValue(null);
      await renderWeightScreen();

      expect(screen.queryByRole("link", { name: "Connect Health Connect" })).not.toBeOnTheScreen();
      expect(screen.queryByText(/Health Connect/)).not.toBeOnTheScreen();
    });
  });

  describe("pull to refresh", () => {
    beforeEach(() => {
      provider.state.permissionGranted = true;
    });

    it("should import once, read the weigh-ins again, and spin until both are done", async () => {
      let finish: (value: HealthImportResult) => void = () => undefined;
      fakeHealthImport.importNow.mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
      await renderWeightScreen();
      await screen.findByText("Weigh-ins");
      const readsBefore = weightBackend.weighInRequestCount;

      await pull();

      expect(fakeHealthImport.importNow).toHaveBeenCalledTimes(1);
      expect(isRefreshing()).toBe(true);
      expect(weightBackend.weighInRequestCount).toBe(readsBefore);

      await act(() => {
        finish(result("imported", 3));
      });

      await waitFor(() => {
        expect(isRefreshing()).toBe(false);
      });
      expect(weightBackend.weighInRequestCount).toBeGreaterThan(readsBefore);
    });

    it("should show the importing line while the pull's import runs", async () => {
      let finish: (value: HealthImportResult) => void = () => undefined;
      fakeHealthImport.importNow.mockImplementation(() => {
        fakeHealthImport.set({ isImporting: true });
        return new Promise((resolve) => {
          finish = resolve;
        });
      });
      await renderWeightScreen();
      await screen.findByText("Weigh-ins");

      await pull();

      expect(screen.getByText("Importing from Health Connect")).toBeOnTheScreen();

      await act(() => {
        fakeHealthImport.set({
          isImporting: false,
          lastImportedAt: new Date(Date.now() - 125_000).toISOString(),
        });
        finish(result("imported"));
      });

      expect(await screen.findByText("Health Connect · updated 2 min ago")).toBeOnTheScreen();
      expect(screen.queryByText("Importing from Health Connect")).not.toBeOnTheScreen();
    });

    it("should import again for a second pull once the first is done", async () => {
      await renderWeightScreen();
      await screen.findByText("Weigh-ins");

      await pull();
      await waitFor(() => {
        expect(isRefreshing()).toBe(false);
      });
      await pull();
      await waitFor(() => {
        expect(isRefreshing()).toBe(false);
      });

      expect(fakeHealthImport.importNow).toHaveBeenCalledTimes(2);
    });

    it("should make one import for two pulls while one runs", async () => {
      fakeHealthImport.importNow.mockReturnValue(new Promise(() => undefined));
      await renderWeightScreen();
      await screen.findByText("Weigh-ins");

      await act(() => {
        refreshControlProps().onRefresh();
        refreshControlProps().onRefresh();
      });

      expect(fakeHealthImport.importNow).toHaveBeenCalledTimes(1);
    });

    it("should only read the weigh-ins again, and show no error, when Health Connect is not connected", async () => {
      provider.state.permissionGranted = false;
      fakeHealthImport.importNow.mockResolvedValue(result("no-permission"));
      await renderWeightScreen();
      await screen.findByText("Weigh-ins");
      const readsBefore = weightBackend.weighInRequestCount;

      await pull();

      await waitFor(() => {
        expect(weightBackend.weighInRequestCount).toBeGreaterThan(readsBefore);
      });
      await waitFor(() => {
        expect(isRefreshing()).toBe(false);
      });
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });

    it("should show nothing new when the pull's import fails", async () => {
      fakeHealthImport.importNow.mockResolvedValue(result("failed"));
      await renderWeightScreen();
      await screen.findByText("Weigh-ins");

      await pull();

      await waitFor(() => {
        expect(isRefreshing()).toBe(false);
      });
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });
  });

  describe("the empty state", () => {
    beforeEach(() => {
      weightBackend.weighIns = [];
    });

    it("should offer Connect Health Connect, which opens the flow, beside Add weigh-in", async () => {
      const user = userEvent.setup();
      await renderWeightScreen();

      await user.press(await screen.findByRole("button", { name: "Connect Health Connect" }));

      expect(routerMock.push).toHaveBeenCalledWith("/more/weight/health");
      expect(screen.getAllByRole("button", { name: "Add weigh-in" }).length).toBeGreaterThan(0);
    });

    it("should not offer it once connected", async () => {
      provider.state.permissionGranted = true;
      await renderWeightScreen();
      await screen.findByText("No weigh-ins yet");
      // The empty state has no status line, so the sign is that the provider was asked, and that is settled.
      await waitFor(() => {
        expect(provider.calls.map((call) => call.method)).toContain("hasPermission");
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(
        screen.queryByRole("button", { name: "Connect Health Connect" }),
      ).not.toBeOnTheScreen();
    });

    it("should not offer it where there is no Health Connect", async () => {
      jest.mocked(getHealthProvider).mockReturnValue(null);
      await renderWeightScreen();
      await screen.findByText("No weigh-ins yet");

      expect(
        screen.queryByRole("button", { name: "Connect Health Connect" }),
      ).not.toBeOnTheScreen();
    });
  });

  describe("words and data", () => {
    it.each([
      [
        "a list, not connected",
        [weighInRow({ localDate: "2026-10-20", utcTime: "07:30", weightKg: 81.6 })],
      ],
      ["an empty list, not connected", []],
    ])("should not mention Apple or HealthKit on %s", async (_name, rows) => {
      weightBackend.weighIns = rows;
      await renderWeightScreen();
      await screen.findByText(rows.length === 0 ? "No weigh-ins yet" : "Weigh-ins");

      expect(screen.root).not.toHaveTextContent(/apple|healthkit/i);
    });

    it("should write no weight, time or sample id to the console or Sentry across an import and a pull", async () => {
      const written: string[] = [];
      for (const level of levels) {
        jest.spyOn(console, level).mockImplementation((...parts: unknown[]) => {
          written.push(parts.map((part) => String(part)).join(" "));
        });
      }
      provider.state.permissionGranted = true;
      fakeHealthImport.importNow.mockResolvedValue(result("failed"));
      await renderWeightScreen();
      await screen.findByText("Weigh-ins");

      await pull();
      await waitFor(() => {
        expect(isRefreshing()).toBe(false);
      });

      const everything = written.join("\n");
      expect(everything).not.toMatch(/81\.6|07:30|2026-10-20|sample/);
      expect(captureException).not.toHaveBeenCalled();
    });
  });
});
