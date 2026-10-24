import "../support/gestureHandler";

import { KeyLowProvider } from "@keylow/api-client";
import { addCalendarDays, toLocalDate } from "@keylow/core/dates";
import { act, render, screen, userEvent, waitFor, within } from "@testing-library/react-native";
import { isValidElement } from "react";

import { WeightScreen } from "../../components/WeightScreen";
import { getHealthProvider } from "../../lib/health";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { fakeHealthImport } from "../support/fakeHealthImport";
import { createFakeHealthProvider } from "../support/fakeHealthProvider";
import { screenWords } from "../support/screenWords";
import {
  bodyMeasurementRow,
  createWeightQueryClient,
  resetWeightBackend,
  weightBackend,
  weightClient,
  weighInRow,
} from "../support/weightBackend";

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

const today = () => toLocalDate(new Date(), "Europe/London");
const dayOf = (daysAgo: number) => addCalendarDays(today(), -daysAgo);

type Kind = "body_fat_pct" | "lean_mass_kg";

let provider: FakeHealthProvider;

// 91 days of a steady loss, newest first as the list reads them.
function seedWeighIns() {
  weightBackend.weighIns = Array.from({ length: 91 }, (_, daysAgo) =>
    weighInRow({
      localDate: dayOf(daysAgo),
      utcTime: "07:30",
      weightKg: Math.round((80 + daysAgo * (0.3 / 7)) * 1000) / 1000,
      timeZone: "UTC",
    }),
  );
}

function readings(kind: Kind, start: number, end: number, days: number, endDaysAgo = 0) {
  return Array.from({ length: days }, (_, index) =>
    bodyMeasurementRow(kind, dayOf(endDaysAgo + index), end + ((start - end) * index) / (days - 1)),
  );
}

function seedBodyReadings() {
  weightBackend.bodyMeasurements = [
    ...readings("body_fat_pct", 23.05, 22.33, 100),
    ...readings("lean_mass_kg", 63.3, 63.08, 100),
  ];
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

const sectionHeading = () => screen.queryByRole("heading", { name: "Body composition" });
const loadingStatus = () =>
  screen.queryByRole("status", { name: "Loading body fat and lean mass" });

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

// The list is named for what it holds, and the refresh control is a prop of the scroll view that carries it.
function refreshControlProps() {
  const control: unknown = screen.getByLabelText("Weigh-ins").props.refreshControl;

  if (!isValidElement<{ onRefresh: () => void }>(control)) {
    throw new Error("The list has no refresh control");
  }
  return control.props;
}

describe("the Weight screen's Body composition section", () => {
  beforeEach(() => {
    resetRouterMock();
    resetWeightBackend();
    fakeHealthImport.reset();
    provider = createFakeHealthProvider({
      permissionGranted: true,
      bodyCompositionAccess: { bodyFat: true, leanMass: true },
    });
    jest.mocked(getHealthProvider).mockReturnValue(provider);
    seedWeighIns();
    seedBodyReadings();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  describe("where it shows", () => {
    it("should sit under the chart's legend and over the Weigh-ins heading", async () => {
      await renderWeightScreen();
      await screen.findByLabelText("Body fat");

      const words = screenWords();
      const legend = words.indexOf("Left out");
      const section = words.indexOf("Body composition");
      // The list is named Weigh-ins too, so its heading is the last of the two.
      const list = words.lastIndexOf("Weigh-ins");

      expect(legend).toBeGreaterThan(-1);
      expect(section).toBeGreaterThan(legend);
      expect(list).toBeGreaterThan(section);
    });

    it("should show the cards for the weigh-ins' person once Health Connect is connected", async () => {
      await renderWeightScreen();

      expect(await screen.findByLabelText("Body fat")).toBeOnTheScreen();
      expect(screen.getByLabelText("Lean mass")).toBeOnTheScreen();
      expect(sectionHeading()).toBeOnTheScreen();
    });

    it("should not show for a person with no weigh-ins, though body readings exist", async () => {
      weightBackend.weighIns = [];
      await renderWeightScreen();
      await screen.findByText(/No weigh-ins yet/i);

      expect(sectionHeading()).not.toBeOnTheScreen();
      expect(weightBackend.bodyRequestCount).toEqual({ body_fat_pct: 0, lean_mass_kg: 0 });
    });

    it("should not show while Health Connect is not connected", async () => {
      provider.state.permissionGranted = false;
      await renderWeightScreen();
      await screen.findByRole("heading", { name: "Weigh-ins" });
      await screen.findByText("Connect Health Connect");

      expect(sectionHeading()).not.toBeOnTheScreen();
    });

    it("should not show on a device with no provider", async () => {
      jest.mocked(getHealthProvider).mockReturnValue(null);
      await renderWeightScreen();
      await screen.findByRole("heading", { name: "Weigh-ins" });

      expect(sectionHeading()).not.toBeOnTheScreen();
    });

    it("should draw nothing, and not a skeleton, while the access is still being read", async () => {
      provider.bodyCompositionAccess = () => new Promise(() => undefined);
      await renderWeightScreen();
      await screen.findByRole("heading", { name: "Weigh-ins" });
      await settle();

      expect(sectionHeading()).not.toBeOnTheScreen();
      expect(loadingStatus()).not.toBeOnTheScreen();
    });
  });

  describe("the one range control", () => {
    it("should change the weight chart and both body cards together", async () => {
      const user = userEvent.setup();
      await renderWeightScreen();
      await screen.findByLabelText("Body fat");

      await user.press(screen.getByRole("radio", { name: "30 days" }));

      expect(
        screen.getByRole("image", { name: /^Weight over the last 30 days, trend / }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole("img", { name: /^Body fat over the last 30 days, trend / }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole("img", { name: /^Lean mass over the last 30 days, trend / }),
      ).toBeOnTheScreen();
      expect(
        within(screen.getByLabelText("Body fat")).getByText(/points over 30 days/),
      ).toBeOnTheScreen();
      expect(
        within(screen.getByLabelText("Lean mass")).getByText(/kg over 30 days/),
      ).toBeOnTheScreen();
    });
  });

  describe("while it loads", () => {
    it("should show the status for the section and keep the weight content usable", async () => {
      weightBackend.bodyReadsHang.body_fat_pct = true;
      await renderWeightScreen();

      expect(
        await screen.findByRole("status", { name: "Loading body fat and lean mass" }),
      ).toBeOnTheScreen();
      expect(screen.getByLabelText("Trend weight")).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Weigh-ins" })).toBeOnTheScreen();
    });
  });

  describe("when the readings cannot be read", () => {
    it("should show the alert, keep the chart, legend and list, and try again", async () => {
      weightBackend.bodyReadsFail.lean_mass_kg = true;
      const user = userEvent.setup();
      await renderWeightScreen();

      await screen.findByRole("alert", { name: /Couldn't load body fat and lean mass/ });

      expect(screen.getByLabelText("Trend weight")).toBeOnTheScreen();
      expect(
        screen.getByRole("image", { name: /^Weight over the last 90 days/ }),
      ).toBeOnTheScreen();
      expect(screen.getByText("Left out")).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Weigh-ins" })).toBeOnTheScreen();

      weightBackend.bodyReadsFail.lean_mass_kg = false;
      await user.press(screen.getByRole("button", { name: "Try again" }));

      expect(await screen.findByLabelText("Lean mass")).toBeOnTheScreen();
    });
  });

  describe("a pull to refresh", () => {
    it("should not bring the loading status back over the cards that are showing", async () => {
      await renderWeightScreen();
      await screen.findByLabelText("Body fat");

      await act(() => {
        refreshControlProps().onRefresh();
      });

      expect(loadingStatus()).not.toBeOnTheScreen();
      expect(screen.getByLabelText("Body fat")).toBeOnTheScreen();
    });
  });

  describe("its words", () => {
    const states: [string, () => void][] = [
      ["chart", () => undefined],
      [
        "settling",
        () => {
          weightBackend.bodyMeasurements = [
            ...readings("body_fat_pct", 22.8, 22.4, 3),
            ...readings("lean_mass_kg", 63.2, 63.1, 3),
          ];
        },
      ],
      [
        "not allowed",
        () => {
          provider.state.bodyCompositionAccess = { bodyFat: false, leanMass: false };
        },
      ],
      [
        "no readings yet",
        () => {
          weightBackend.bodyMeasurements = [];
        },
      ],
      [
        "partial",
        () => {
          provider.state.bodyCompositionAccess = { bodyFat: true, leanMass: false };
        },
      ],
      [
        "loading",
        () => {
          weightBackend.bodyReadsHang.body_fat_pct = true;
        },
      ],
      [
        "error",
        () => {
          weightBackend.bodyReadsFail.body_fat_pct = true;
        },
      ],
    ];

    it.each(states)(
      "should say muscle only in the approved caption and name no Apple service: %s",
      async (_name, arrange) => {
        arrange();
        await renderWeightScreen();
        await waitFor(() => {
          expect(sectionHeading()).toBeOnTheScreen();
        });
        await settle();

        const withoutCaption = screenWords()
          .join("\n")
          .replace("Lean mass includes bone and water as well as muscle.", "");

        expect(withoutCaption).not.toMatch(/muscle/i);
        expect(withoutCaption).not.toMatch(/apple|healthkit|\bios\b|iphone/i);
      },
    );
  });

  describe("its console output", () => {
    it("should write no body fat or lean mass value, time or id in any state", async () => {
      const written: string[] = [];
      for (const level of ["log", "info", "warn", "error"] as const) {
        jest.spyOn(console, level).mockImplementation((...parts: unknown[]) => {
          written.push(
            parts
              .map((part) =>
                part instanceof Error ? String(part.cause) + part.message : String(part),
              )
              .join(" "),
          );
        });
      }
      weightBackend.bodyReadsFail.lean_mass_kg = true;
      await renderWeightScreen();
      await screen.findByRole("alert", { name: /Couldn't load body fat and lean mass/ });
      weightBackend.bodyReadsFail.lean_mass_kg = false;
      await userEvent.setup().press(screen.getByRole("button", { name: "Try again" }));
      await screen.findByLabelText("Lean mass");
      await userEvent.setup().press(screen.getByRole("radio", { name: "1 week" }));

      const text = written.join("\n");

      for (const secret of ["22.", "63.", "88888888", "07:00", dayOf(1), "raw database text"]) {
        expect(text).not.toContain(secret);
      }
    });
  });

  it("should open the permission flow for body composition from the not allowed prompt", async () => {
    provider.state.bodyCompositionAccess = { bodyFat: false, leanMass: false };
    await renderWeightScreen();

    await userEvent
      .setup()
      .press(await screen.findByRole("button", { name: "Add body fat and lean mass" }));

    expect(routerMock.push).toHaveBeenCalledWith("/more/weight/health?add=body-composition");
  });
});
