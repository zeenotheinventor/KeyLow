import "../support/gestureHandler";

import { KeyLowProvider } from "@keylow/api-client";
import { addCalendarDays } from "@keylow/core/dates";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { BodyCompositionSection } from "../../components/BodyCompositionSection";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import {
  bodyMeasurementRow,
  createWeightQueryClient,
  resetWeightBackend,
  weightBackend,
  weightClient,
} from "../support/weightBackend";

import type { BodyCompositionSectionProps } from "../../components/BodyCompositionSection";
import type { QueryClient } from "@tanstack/react-query";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
// Skia draws nothing in Jest. The canvas, path and circle here are views that keep the props they were given.
jest.mock("@shopify/react-native-skia", () => {
  const { createElement } = jest.requireActual<typeof import("react")>("react");
  const drawing = (name: string) => (props: object) => createElement(name, props);
  return {
    __esModule: true,
    Canvas: drawing("Canvas"),
    Path: drawing("Path"),
    Circle: drawing("Circle"),
  };
});

setUpTests();

const today = "2026-10-17";
const bothAllowed = { bodyFat: true, leanMass: true };

type Kind = "body_fat_pct" | "lean_mass_kg";

// One reading a day for `days` days up to today, all the same value, so the trend sits on it.
function steadyReadings(kind: Kind, value: number, days: number) {
  return Array.from({ length: days }, (_, index) =>
    bodyMeasurementRow(kind, addCalendarDays(today, -index), value),
  );
}

let queryClient: QueryClient;

async function renderUnderComposition(props: Partial<BodyCompositionSectionProps> = {}) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={weightClient} queryClient={queryClient}>
        <BodyCompositionSection
          isUnderComposition
          access={bothAllowed}
          range={90}
          today={today}
          {...props}
        />
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

const heading = () => screen.queryByRole("heading", { name: "Body composition" });
const caption = () => screen.queryByText("Lean mass includes bone and water as well as muscle.");

describe("BodyCompositionSection under the composition view", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/BodyCompositionSection",
      "components/BodyCompositionCard",
      "components/BodyCompositionPrompt",
    ]);
  });

  beforeEach(() => {
    resetRouterMock();
    resetWeightBackend();
    registerAppStyles(kitStyles);
    queryClient = createWeightQueryClient();
  });

  afterEach(async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it("should draw its heading and its cards, and not the caption the view above draws", async () => {
    weightBackend.bodyMeasurements = [
      ...steadyReadings("body_fat_pct", 22.4, 100),
      ...steadyReadings("lean_mass_kg", 63.1, 100),
    ];
    await renderUnderComposition();

    expect(await screen.findByLabelText("Body fat")).toBeOnTheScreen();
    expect(screen.getByLabelText("Lean mass")).toBeOnTheScreen();
    expect(heading()).toBeOnTheScreen();
    expect(caption()).not.toBeOnTheScreen();
  });

  it("should draw the compact prompt for the kind that is not allowed, under the card of the other", async () => {
    weightBackend.bodyMeasurements = steadyReadings("body_fat_pct", 22.4, 100);
    await renderUnderComposition({ access: { bodyFat: true, leanMass: false } });

    expect(await screen.findByLabelText("Body fat")).toBeOnTheScreen();
    expect(screen.getByText("Ki-Lo can't read lean mass yet.")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Add lean mass" })).toBeOnTheScreen();
  });

  it("should draw nothing for neither kind allowed, because the view above draws that prompt", async () => {
    await renderUnderComposition({ access: { bodyFat: false, leanMass: false } });
    await settle();

    expect(heading()).not.toBeOnTheScreen();
    expect(screen.queryByText("See body fat and lean mass here")).not.toBeOnTheScreen();
    expect(screen.queryByText("Ki-Lo can't read body fat yet.")).not.toBeOnTheScreen();
    expect(screen.queryByText("Ki-Lo can't read lean mass yet.")).not.toBeOnTheScreen();
  });

  it("should draw no loading status while a kind is being read", async () => {
    weightBackend.bodyReadsHang.body_fat_pct = true;
    weightBackend.bodyReadsHang.lean_mass_kg = true;
    await renderUnderComposition();
    await settle();

    expect(
      screen.queryByRole("status", { name: "Loading body fat and lean mass" }),
    ).not.toBeOnTheScreen();
  });

  it("should draw no error prompt when a kind fails, and still draw the card of the other", async () => {
    weightBackend.bodyReadsFail.body_fat_pct = true;
    weightBackend.bodyMeasurements = steadyReadings("lean_mass_kg", 63.1, 100);
    await renderUnderComposition();

    expect(await screen.findByLabelText("Lean mass")).toBeOnTheScreen();
    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeOnTheScreen();
  });

  it("should draw no no-readings prompt when both are allowed with nothing read, and no heading over nothing", async () => {
    await renderUnderComposition();
    await settle();

    expect(screen.queryByText("No body fat or lean mass readings yet")).not.toBeOnTheScreen();
    expect(heading()).not.toBeOnTheScreen();
  });

  it("should still draw the compact prompt for the other kind when the one allowed has no readings", async () => {
    await renderUnderComposition({ access: { bodyFat: false, leanMass: true } });

    expect(await screen.findByText("Ki-Lo can't read body fat yet.")).toBeOnTheScreen();
    expect(screen.queryByText("No body fat or lean mass readings yet")).not.toBeOnTheScreen();
  });
});
