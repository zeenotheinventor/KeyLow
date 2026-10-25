import "../support/gestureHandler";

import { KeyLowProvider } from "@keylow/api-client";
import { addCalendarDays, toLocalDate } from "@keylow/core/dates";
import { act, render, screen, userEvent, waitFor } from "@testing-library/react-native";

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

// The device store, as a map the test can fill before the screen opens and read after a press.
const mockStoredItems = new Map<string, string>();
const readStoredItem = (key: string) => Promise.resolve(mockStoredItems.get(key) ?? null);
const mockGetItem = jest.fn(readStoredItem);
const mockSetItem = jest.fn((key: string, value: string) => {
  mockStoredItems.set(key, value);
  return Promise.resolve();
});

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => mockGetItem(key),
    setItem: (key: string, value: string) => mockSetItem(key, value),
  },
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

const CAPTION = "Lean mass includes bone and water as well as muscle.";
const NOT_ALLOWED_TITLE = "See body fat and lean mass here";
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

// One reading a day for 100 days, all the same value, so the trend sits on it.
function steadyReadings(kind: Kind, value: number) {
  return Array.from({ length: 100 }, (_, index) => bodyMeasurementRow(kind, dayOf(index), value));
}

function seedBodyReadings() {
  weightBackend.bodyMeasurements = [
    ...steadyReadings("body_fat_pct", 21.37),
    ...steadyReadings("lean_mass_kg", 61.83),
  ];
}

function storeChoice(view: string, unit?: string) {
  mockStoredItems.set("weight.chartView", view);
  if (unit !== undefined) {
    mockStoredItems.set("weight.compositionUnit", unit);
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

// What a console call wrote, as text. An object is serialised, because String() turns it into "[object Object]",
// and an error is its message and its cause.
function textOf(part: unknown): string {
  if (typeof part === "string") {
    return part;
  }
  if (part instanceof Error) {
    return `${part.message} ${textOf(part.cause)}`;
  }
  try {
    // JSON.stringify answers undefined at run time for a function or undefined, which its type leaves out.
    const json: unknown = JSON.stringify(part);
    return typeof json === "string" ? json : String(part);
  } catch {
    return String(part);
  }
}

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

const weightFigure = (span = "90 days") =>
  screen.queryByRole("image", { name: new RegExp(`^Weight over the last ${span}, trend `) });
const compositionFigure = (span = "90 days") =>
  screen.queryByRole("img", { name: new RegExp(`^Body fat and lean mass over the last ${span}`) });
const sectionHeading = () => screen.queryByRole("heading", { name: "Body composition" });

describe("the Weight screen's Weight / Composition switch", () => {
  beforeEach(() => {
    resetRouterMock();
    resetWeightBackend();
    fakeHealthImport.reset();
    mockStoredItems.clear();
    mockGetItem.mockReset().mockImplementation(readStoredItem);
    mockSetItem.mockClear();
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

  describe("when Health Connect is connected", () => {
    it("should offer Chart view with Weight chosen, and draw the weight figure and its legend", async () => {
      await renderWeightScreen();
      await screen.findByLabelText("Chart view");

      // The role query does not resolve a radiogroup, so the group is found by its name and checked for its role.
      expect(screen.getByLabelText("Chart view")).toHaveProp("role", "radiogroup");
      expect(screen.getByRole("radio", { name: "Weight", checked: true })).toBeOnTheScreen();
      expect(screen.getByRole("radio", { name: "Composition", checked: false })).toBeOnTheScreen();
      expect(weightFigure()).toBeOnTheScreen();
      expect(compositionFigure()).not.toBeOnTheScreen();
      expect(screen.getByText("Left out")).toBeOnTheScreen();
    });

    it("should sit between the Trend weight card and the range control", async () => {
      await renderWeightScreen();
      await screen.findByLabelText("Chart view");

      const words = screenWords();

      expect(words.indexOf("Chart view")).toBeGreaterThan(words.indexOf("Trend weight"));
      expect(words.indexOf("Chart range")).toBeGreaterThan(words.indexOf("Chart view"));
    });

    it("should swap the weight figure for the composition figure, and back", async () => {
      const user = userEvent.setup();
      await renderWeightScreen();
      await screen.findByLabelText("Chart view");

      await user.press(screen.getByRole("radio", { name: "Composition" }));

      expect(
        await screen.findByRole("img", {
          name: "Body fat and lean mass over the last 90 days, body fat 17.2 kg, lean mass 63.2 kg",
        }),
      ).toBeOnTheScreen();
      expect(weightFigure()).not.toBeOnTheScreen();
      expect(screen.queryByText("Left out")).not.toBeOnTheScreen();
      expect(screen.getByLabelText("Show as")).toHaveProp("role", "radiogroup");

      await user.press(screen.getByRole("radio", { name: "Weight" }));

      expect(weightFigure()).toBeOnTheScreen();
      expect(screen.getByText("Left out")).toBeOnTheScreen();
      expect(compositionFigure()).not.toBeOnTheScreen();
      expect(screen.queryByLabelText("Show as")).not.toBeOnTheScreen();
    });

    it("should keep the Body composition section and the list under the card in both views", async () => {
      const user = userEvent.setup();
      await renderWeightScreen();
      await screen.findByLabelText("Body fat");

      await user.press(screen.getByRole("radio", { name: "Composition" }));
      await screen.findByRole("img", { name: /^Body fat and lean mass over the last 90 days/ });

      expect(sectionHeading()).toBeOnTheScreen();
      expect(screen.getByLabelText("Body fat")).toBeOnTheScreen();
      expect(screen.getByLabelText("Lean mass")).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Weigh-ins" })).toBeOnTheScreen();
    });

    it("should let the one range control drive both views", async () => {
      const user = userEvent.setup();
      await renderWeightScreen();
      await screen.findByLabelText("Chart view");
      await user.press(screen.getByRole("radio", { name: "Composition" }));
      await screen.findByRole("img", { name: /^Body fat and lean mass over the last 90 days/ });

      await user.press(screen.getByRole("radio", { name: "30 days" }));

      expect(compositionFigure("30 days")).toBeOnTheScreen();

      await user.press(screen.getByRole("radio", { name: "Weight" }));

      expect(weightFigure("30 days")).toBeOnTheScreen();
    });
  });

  describe("what is remembered", () => {
    it("should open on the composition figure with % chosen when those were saved", async () => {
      storeChoice("composition", "pct");
      await renderWeightScreen();

      expect(
        await screen.findByRole("img", {
          name: "Body fat and lean mass over the last 90 days, body fat 21.4 %, lean mass 78.6 %",
        }),
      ).toBeOnTheScreen();
      expect(screen.getByRole("radio", { name: "Composition", checked: true })).toBeOnTheScreen();
      expect(screen.getByRole("radio", { name: "%", checked: true })).toBeOnTheScreen();
      expect(weightFigure()).not.toBeOnTheScreen();
    });

    it("should save the unit and the view when they are pressed", async () => {
      storeChoice("composition", "pct");
      const user = userEvent.setup();
      await renderWeightScreen();
      await screen.findByRole("radio", { name: "%", checked: true });

      await user.press(screen.getByRole("radio", { name: "kg" }));
      await user.press(screen.getByRole("radio", { name: "Weight" }));

      expect(mockSetItem).toHaveBeenCalledWith("weight.compositionUnit", "kg");
      expect(mockSetItem).toHaveBeenCalledWith("weight.chartView", "weight");
    });

    it("should show the last choice when the screen is opened again", async () => {
      const user = userEvent.setup();
      const first = await render(
        <ThemeProvider fixedPreference="dark">
          <KeyLowProvider client={weightClient} queryClient={createWeightQueryClient()}>
            <WeightScreen />
          </KeyLowProvider>
        </ThemeProvider>,
      );
      await user.press(await screen.findByRole("radio", { name: "Composition" }));
      await first.unmount();

      await renderWeightScreen();

      expect(
        await screen.findByRole("radio", { name: "Composition", checked: true }),
      ).toBeOnTheScreen();
      expect(weightFigure()).not.toBeOnTheScreen();
    });

    it("should show the loading status, and no weight figure, until the store has answered", async () => {
      const answers: (() => void)[] = [];
      mockGetItem.mockImplementation(
        (key) =>
          new Promise<string | null>((resolve) => {
            answers.push(() => {
              resolve(key === "weight.chartView" ? "composition" : null);
            });
          }),
      );
      await renderWeightScreen();
      await settle();

      expect(screen.getByRole("status", { name: "Loading your weigh-ins" })).toBeOnTheScreen();
      expect(weightFigure()).not.toBeOnTheScreen();
      expect(screen.queryByLabelText("Trend weight")).not.toBeOnTheScreen();

      await act(() => {
        answers.forEach((answer) => {
          answer();
        });
      });

      expect(await screen.findByLabelText("Trend weight")).toBeOnTheScreen();
      expect(weightFigure()).not.toBeOnTheScreen();
    });
  });

  describe("when Health Connect is not connected", () => {
    beforeEach(() => {
      provider.state.permissionGranted = false;
    });

    it("should show the switch, and the not-allowed prompt in the Composition view", async () => {
      const user = userEvent.setup();
      await renderWeightScreen();
      await user.press(await screen.findByRole("radio", { name: "Composition" }));

      expect(await screen.findByText(NOT_ALLOWED_TITLE)).toBeOnTheScreen();
      expect(weightFigure()).not.toBeOnTheScreen();
      expect(sectionHeading()).not.toBeOnTheScreen();

      await user.press(screen.getByRole("button", { name: "Add body fat and lean mass" }));

      expect(routerMock.push).toHaveBeenCalledWith("/more/weight/health");
    });
  });

  describe("when there is no switch", () => {
    it("should draw the weight figure and no Chart view on a device with no provider, whatever is saved", async () => {
      storeChoice("composition");
      jest.mocked(getHealthProvider).mockReturnValue(null);
      await renderWeightScreen();
      await screen.findByLabelText("Trend weight");

      expect(screen.queryByLabelText("Chart view")).not.toBeOnTheScreen();
      expect(weightFigure()).toBeOnTheScreen();
    });

    it("should draw the weight figure and no Chart view while the connection is being checked, and keep the saved choice", async () => {
      storeChoice("composition");
      provider.availability = () => new Promise(() => undefined);
      await renderWeightScreen();
      await screen.findByLabelText("Trend weight");
      await settle();

      expect(screen.queryByLabelText("Chart view")).not.toBeOnTheScreen();
      expect(weightFigure()).toBeOnTheScreen();
      expect(mockSetItem).not.toHaveBeenCalled();
    });
  });

  describe("in the Composition view, nothing is drawn twice", () => {
    beforeEach(() => {
      storeChoice("composition");
    });

    it("should draw the not-allowed prompt once when neither kind is allowed", async () => {
      provider.state.bodyCompositionAccess = { bodyFat: false, leanMass: false };
      await renderWeightScreen();
      await screen.findByText(NOT_ALLOWED_TITLE);
      await settle();

      expect(screen.getAllByText(NOT_ALLOWED_TITLE)).toHaveLength(1);
      expect(screen.getAllByRole("button", { name: "Add body fat and lean mass" })).toHaveLength(1);
      expect(sectionHeading()).not.toBeOnTheScreen();
    });

    it("should draw the caption once", async () => {
      await renderWeightScreen();
      await screen.findByRole("img", { name: /^Body fat and lean mass over the last 90 days/ });
      await screen.findByLabelText("Lean mass");

      expect(screen.getAllByText(CAPTION)).toHaveLength(1);
    });

    it("should draw the loading status once", async () => {
      weightBackend.bodyReadsHang.body_fat_pct = true;
      await renderWeightScreen();
      await settle();

      expect(
        screen.getAllByRole("status", { name: "Loading body fat and lean mass" }),
      ).toHaveLength(1);
    });

    it("should draw the error prompt once", async () => {
      weightBackend.bodyReadsFail.body_fat_pct = true;
      weightBackend.bodyReadsFail.lean_mass_kg = true;
      await renderWeightScreen();
      await screen.findByRole("alert", { name: /Couldn't load body fat and lean mass/ });
      await settle();

      expect(screen.getAllByRole("alert")).toHaveLength(1);
    });

    it("should draw the no-readings prompt once", async () => {
      weightBackend.bodyMeasurements = [];
      await renderWeightScreen();
      await screen.findByText("No body fat or lean mass readings yet");
      await settle();

      expect(screen.getAllByText("No body fat or lean mass readings yet")).toHaveLength(1);
    });

    it("should still show the compact prompt for the kind that cannot be read, under the card", async () => {
      provider.state.bodyCompositionAccess = { bodyFat: true, leanMass: false };
      weightBackend.bodyMeasurements = steadyReadings("body_fat_pct", 21.37);
      await renderWeightScreen();
      await screen.findByRole("img", { name: /^Body fat and lean mass over the last 90 days/ });

      expect(await screen.findByText("Ki-Lo can't read lean mass yet.")).toBeOnTheScreen();
      expect(screen.getAllByText("Ki-Lo can't read lean mass yet.")).toHaveLength(1);
      expect(screen.getByLabelText("Body fat")).toBeOnTheScreen();
    });
  });

  describe("its controls", () => {
    it("should add no button in the Composition view beyond the ones the weight view has", async () => {
      storeChoice("composition");
      await renderWeightScreen();
      await screen.findByLabelText("Show as");

      // The back, explainer and add buttons, and a weigh-in row, which is named for its day and time.
      const known = [
        /^Back to More$/,
        /^How the trend works$/,
        /^Add weigh-in$/,
        /^[^,]+, \d\d:\d\d · /,
      ];
      const namedCount = known.reduce(
        (count, name) => count + screen.queryAllByRole("button", { name }).length,
        0,
      );

      expect(namedCount).toBe(screen.getAllByRole("button").length);
    });
  });

  describe("its words", () => {
    it.each([
      ["Weight", "weight"],
      ["Composition", "composition"],
    ])(
      "should say muscle only in the approved caption and name no Apple service: %s view",
      async (_name, view) => {
        storeChoice(view);
        await renderWeightScreen();
        await screen.findByLabelText("Lean mass");
        await settle();

        const withoutCaption = screenWords().join("\n").replace(CAPTION, "");

        expect(withoutCaption).not.toMatch(/muscle/i);
        expect(withoutCaption).not.toMatch(/apple|healthkit|\bios\b|iphone/i);
      },
    );
  });

  describe("its console output", () => {
    it("should write no weight, body fat or lean mass value in either view", async () => {
      const written: string[] = [];
      for (const level of ["log", "info", "warn", "error"] as const) {
        jest.spyOn(console, level).mockImplementation((...parts: unknown[]) => {
          written.push(parts.map(textOf).join(" "));
        });
      }
      const user = userEvent.setup();
      await renderWeightScreen();
      await user.press(await screen.findByRole("radio", { name: "Composition" }));
      await screen.findByRole("img", { name: /^Body fat and lean mass over the last 90 days/ });
      await user.press(screen.getByRole("radio", { name: "%" }));
      await user.press(screen.getByRole("radio", { name: "1 week" }));
      await user.press(screen.getByRole("radio", { name: "Weight" }));
      await settle();

      const text = written.join("\n");

      for (const secret of ["21.37", "61.83", "17.2", "63.2", "78.6", "80.", dayOf(1)]) {
        expect(text).not.toContain(secret);
      }
    });
  });
});
