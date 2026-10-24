import "../support/gestureHandler";

import { KeyLowProvider } from "@keylow/api-client";
import { addCalendarDays } from "@keylow/core/dates";
import { act, render, screen, userEvent, waitFor, within } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { BodyCompositionSection } from "../../components/BodyCompositionSection";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { screenWords } from "../support/screenWords";
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
const route = "/more/weight/health?add=body-composition";

type Kind = "body_fat_pct" | "lean_mass_kg";

// One reading a day for `days` days, the last `endDaysAgo` days before today, moving in a straight line from
// `start` to `end`. Newest first, as the lists read them.
function readings(kind: Kind, start: number, end: number, days: number, endDaysAgo = 0) {
  return Array.from({ length: days }, (_, index) => {
    const daysAgo = endDaysAgo + index;
    const value = end + ((start - end) * index) / (days - 1);

    return bodyMeasurementRow(kind, addCalendarDays(today, -daysAgo), value);
  });
}

// A settled series whose 90 day change is about −0.6 points and −0.2 kg, so the cards read as the board's do.
const bodyFatSeries = () => readings("body_fat_pct", 23.05, 22.33, 100);
const leanMassSeries = () => readings("lean_mass_kg", 63.3, 63.08, 100);

let queryClient: QueryClient;

function sectionOver(props: Partial<BodyCompositionSectionProps>) {
  return (
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={weightClient} queryClient={queryClient}>
        <BodyCompositionSection access={bothAllowed} range={90} today={today} {...props} />
      </KeyLowProvider>
    </ThemeProvider>
  );
}

async function renderSection(props: Partial<BodyCompositionSectionProps> = {}) {
  const view = await render(sectionOver(props));

  return {
    changeRange: (range: BodyCompositionSectionProps["range"]) =>
      view.rerender(sectionOver({ ...props, range })),
  };
}

const bodyFatCard = () => within(screen.getByLabelText("Body fat"));
const leanMassCard = () => within(screen.getByLabelText("Lean mass"));
const caption = () => screen.queryByText("Lean mass includes bone and water as well as muscle.");

describe("BodyCompositionSection", () => {
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

  // The reads settle after a test has what it came for, and the update they cause is waited out.
  afterEach(async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  describe("chart", () => {
    beforeEach(() => {
      weightBackend.bodyMeasurements = [...bodyFatSeries(), ...leanMassSeries()];
    });

    it("should be headed Body composition", async () => {
      await renderSection();

      expect(await screen.findByRole("heading", { name: "Body composition" })).toBeOnTheScreen();
    });

    it("should show body fat with its change, its value, its unit and its trend line", async () => {
      await renderSection();

      await screen.findByLabelText("Body fat");

      expect(bodyFatCard().getByText("−0.6 points over 90 days")).toBeOnTheScreen();
      expect(bodyFatCard().getByText("22.4")).toBeOnTheScreen();
      expect(bodyFatCard().getByText("%")).toBeOnTheScreen();
      expect(
        screen.getByRole("img", { name: "Body fat over the last 90 days, trend 22.4 %" }),
      ).toBeOnTheScreen();
    });

    it("should show lean mass in kilograms with its change", async () => {
      await renderSection();

      await screen.findByLabelText("Lean mass");

      expect(leanMassCard().getByText("−0.2 kg over 90 days")).toBeOnTheScreen();
      expect(leanMassCard().getByText("63.1")).toBeOnTheScreen();
      expect(leanMassCard().getByText("kg")).toBeOnTheScreen();
      expect(
        screen.getByRole("img", { name: "Lean mass over the last 90 days, trend 63.1 kg" }),
      ).toBeOnTheScreen();
    });

    it("should put body fat above lean mass and show the caption under them", async () => {
      await renderSection();

      await screen.findByLabelText("Lean mass");

      const cards = screen.getAllByLabelText(/^(Body fat|Lean mass)$/);

      expect(cards).toHaveLength(2);
      expect(cards[0]).toHaveAccessibleName("Body fat");
      expect(cards[1]).toHaveAccessibleName("Lean mass");
      expect(caption()).toBeOnTheScreen();
    });

    it("should read only the kinds that are allowed", async () => {
      await renderSection({ access: { bodyFat: true, leanMass: false } });

      await screen.findByLabelText("Body fat");

      expect(weightBackend.bodyRequestCount.lean_mass_kg).toBe(0);
    });
  });

  describe("switching the range", () => {
    it("should change both cards together, and turn a missing change into a figure when the range widens", async () => {
      // The last reading was ten days ago, so a week holds none and a month holds enough.
      weightBackend.bodyMeasurements = [
        ...readings("body_fat_pct", 23.05, 22.33, 60, 10),
        ...readings("lean_mass_kg", 63.3, 63.08, 60, 10),
      ];
      const { changeRange } = await renderSection({ range: 7 });

      await screen.findByLabelText("Body fat");

      expect(
        bodyFatCard().getByText("Not enough readings in the last week to show a change."),
      ).toBeOnTheScreen();
      expect(
        leanMassCard().getByText("Not enough readings in the last week to show a change."),
      ).toBeOnTheScreen();

      await changeRange(30);

      expect(await bodyFatCard().findByText(/points over 30 days/)).toBeOnTheScreen();
      expect(leanMassCard().getByText(/kg over 30 days/)).toBeOnTheScreen();
      expect(
        screen.getByRole("img", { name: /^Body fat over the last 30 days, trend / }),
      ).toBeOnTheScreen();
      expect(screen.queryByText(/Not enough readings/)).not.toBeOnTheScreen();
    });

    it.each([
      [7, "the last week"],
      [30, "the last 30 days"],
      [90, "the last 90 days"],
      [365, "the last year"],
    ] as const)(
      "should say the range holds too few readings over %i days, with the value and no badge or line",
      async (range, words) => {
        weightBackend.bodyMeasurements = [
          ...readings("body_fat_pct", 23.05, 22.33, 40, range + 5),
          ...readings("lean_mass_kg", 63.3, 63.08, 40, range + 5),
        ];
        await renderSection({ range });

        await screen.findByLabelText("Body fat");

        expect(
          bodyFatCard().getByText(`Not enough readings in ${words} to show a change.`),
        ).toBeOnTheScreen();
        expect(bodyFatCard().queryByText(/ over /)).not.toBeOnTheScreen();
        expect(screen.queryByRole("img")).not.toBeOnTheScreen();
        expect(bodyFatCard().queryByText("Settling")).not.toBeOnTheScreen();
      },
    );
  });

  describe("the trend line", () => {
    // The x of every point of a drawn line, read from the path the mocked canvas was given.
    const lineXs = () =>
      (screen.root?.queryAll((node) => node.type === "Path") ?? []).flatMap((path) =>
        String(path.props.path)
          .split(/[ML]/)
          .filter((point) => point !== "")
          .map((point) => Number(point.trim().split(" ")[0])),
      );

    it("should be placed by date, starting after the left inset and stopping short of the right edge, when the readings ended ten days ago", async () => {
      // A month holds the twelve readings that ended ten days ago, so the line is drawn with a gap on each side.
      weightBackend.bodyMeasurements = [
        ...readings("body_fat_pct", 23.05, 22.33, 12, 10),
        ...readings("lean_mass_kg", 63.3, 63.08, 12, 10),
      ];
      await renderSection({ range: 30 });

      await screen.findByRole("img", { name: /^Body fat over the last 30 days/ });
      const xs = lineXs();

      // The canvas is 128 wide with a 4 point inset: the first day of the range is at 4 and today is at 124.
      expect(xs.length).toBeGreaterThan(0);
      expect(Math.min(...xs)).toBeGreaterThan(30);
      expect(Math.max(...xs)).toBeLessThan(100);
    });
  });

  describe("settling", () => {
    it("should show the value, Settling and the count, with no change badge and no line", async () => {
      weightBackend.bodyMeasurements = [
        ...readings("body_fat_pct", 22.8, 22.4, 3),
        ...readings("lean_mass_kg", 63.2, 63.1, 3),
      ];
      await renderSection();

      await screen.findByLabelText("Body fat");

      expect(bodyFatCard().getByText("Settling")).toBeOnTheScreen();
      expect(bodyFatCard().getByText("Settles after 7 readings. 3 of 7 so far.")).toBeOnTheScreen();
      expect(screen.queryByText(/ over 90 days/)).not.toBeOnTheScreen();
      expect(screen.queryByRole("img")).not.toBeOnTheScreen();
    });

    it("should count the readings and not the days, when a day has none", async () => {
      // Four readings over five days: the trend has a point for the day between, and that is not a reading.
      weightBackend.bodyMeasurements = [0, 1, 3, 4].map((daysAgo) =>
        bodyMeasurementRow("body_fat_pct", addCalendarDays(today, -daysAgo), 22.5 + daysAgo / 10),
      );
      await renderSection({ access: { bodyFat: true, leanMass: false } });

      await screen.findByLabelText("Body fat");

      expect(bodyFatCard().getByText("Settles after 7 readings. 4 of 7 so far.")).toBeOnTheScreen();
    });

    it("should settle one kind and not the other", async () => {
      weightBackend.bodyMeasurements = [
        ...bodyFatSeries(),
        ...readings("lean_mass_kg", 63.2, 63.1, 3),
      ];
      await renderSection();

      await screen.findByLabelText("Lean mass");

      expect(leanMassCard().getByText("Settling")).toBeOnTheScreen();
      expect(bodyFatCard().queryByText("Settling")).not.toBeOnTheScreen();
      expect(bodyFatCard().getByText("−0.6 points over 90 days")).toBeOnTheScreen();
    });
  });

  describe("not allowed", () => {
    it("should show the prompt with its action and no card, caption or request", async () => {
      await renderSection({ access: { bodyFat: false, leanMass: false } });

      expect(await screen.findByText("See body fat and lean mass here")).toBeOnTheScreen();
      expect(screen.queryByLabelText("Body fat")).not.toBeOnTheScreen();
      expect(caption()).not.toBeOnTheScreen();
      expect(weightBackend.bodyRequestCount).toEqual({ body_fat_pct: 0, lean_mass_kg: 0 });
    });

    it("should open the permission flow for body composition when the action is pressed", async () => {
      await renderSection({ access: { bodyFat: false, leanMass: false } });

      await userEvent
        .setup()
        .press(await screen.findByRole("button", { name: "Add body fat and lean mass" }));

      expect(routerMock.push).toHaveBeenCalledWith(route);
    });
  });

  describe("no readings yet", () => {
    it("should show its words with no card, no action and no caption", async () => {
      await renderSection();

      expect(await screen.findByText("No body fat or lean mass readings yet")).toBeOnTheScreen();
      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
      expect(caption()).not.toBeOnTheScreen();
    });
  });

  describe("partial", () => {
    it("should show body fat's card, then the prompt for lean mass, with no caption", async () => {
      weightBackend.bodyMeasurements = bodyFatSeries();
      await renderSection({ access: { bodyFat: true, leanMass: false } });

      await screen.findByLabelText("Body fat");

      expect(screen.getByText("Ki-Lo can't read lean mass yet.")).toBeOnTheScreen();
      expect(screen.queryByLabelText("Lean mass")).not.toBeOnTheScreen();
      expect(caption()).not.toBeOnTheScreen();
    });

    it("should draw the card before the compact prompt", async () => {
      weightBackend.bodyMeasurements = bodyFatSeries();
      await renderSection({ access: { bodyFat: true, leanMass: false } });
      await screen.findByLabelText("Body fat");

      const words = screenWords();

      expect(words.indexOf("Body fat")).toBeGreaterThan(-1);
      expect(words.indexOf("Ki-Lo can't read lean mass yet.")).toBeGreaterThan(
        words.indexOf("Body fat"),
      );
    });

    it("should show lean mass's card with the caption, then the prompt for body fat", async () => {
      weightBackend.bodyMeasurements = leanMassSeries();
      await renderSection({ access: { bodyFat: false, leanMass: true } });

      await screen.findByLabelText("Lean mass");

      expect(screen.getByText("Ki-Lo can't read body fat yet.")).toBeOnTheScreen();
      expect(caption()).toBeOnTheScreen();
    });

    it.each([
      [{ bodyFat: true, leanMass: false }, "Add lean mass"],
      [{ bodyFat: false, leanMass: true }, "Add body fat"],
    ])("should open the same route from the prompt's action: %j", async (access, action) => {
      weightBackend.bodyMeasurements = [...bodyFatSeries(), ...leanMassSeries()];
      await renderSection({ access });

      await userEvent.setup().press(await screen.findByRole("button", { name: action }));

      expect(routerMock.push).toHaveBeenCalledWith(route);
    });
  });

  describe("when one allowed kind has readings and the other has none", () => {
    it("should draw the card for the kind with readings and nothing for the other (a), body fat", async () => {
      weightBackend.bodyMeasurements = bodyFatSeries();
      await renderSection();

      await screen.findByLabelText("Body fat");

      expect(screen.queryByLabelText("Lean mass")).not.toBeOnTheScreen();
      expect(screen.queryByText("No body fat or lean mass readings yet")).not.toBeOnTheScreen();
      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
      expect(caption()).not.toBeOnTheScreen();
    });

    it("should draw the card for the kind with readings and nothing for the other (a), lean mass, with the caption", async () => {
      weightBackend.bodyMeasurements = leanMassSeries();
      await renderSection();

      await screen.findByLabelText("Lean mass");

      expect(screen.queryByLabelText("Body fat")).not.toBeOnTheScreen();
      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
      expect(caption()).toBeOnTheScreen();
    });

    it("should show the no readings prompt, then the prompt for the kind that is not allowed (b)", async () => {
      await renderSection({ access: { bodyFat: true, leanMass: false } });

      expect(await screen.findByText("No body fat or lean mass readings yet")).toBeOnTheScreen();
      expect(screen.getByText("Ki-Lo can't read lean mass yet.")).toBeOnTheScreen();
      expect(screen.queryByLabelText("Body fat")).not.toBeOnTheScreen();
      expect(caption()).not.toBeOnTheScreen();
    });
  });

  describe("while the readings load", () => {
    beforeEach(() => {
      weightBackend.bodyReadsHang.body_fat_pct = true;
    });

    it("should show one status named Loading body fat and lean mass", async () => {
      await renderSection();

      expect(
        await screen.findByRole("status", { name: "Loading body fat and lean mass" }),
      ).toBeOnTheScreen();
      expect(screen.getAllByRole("status")).toHaveLength(1);
      expect(screen.getByRole("heading", { name: "Body composition" })).toBeOnTheScreen();
    });

    it("should show the status and not the alert when the other kind has failed", async () => {
      weightBackend.bodyReadsFail.lean_mass_kg = true;
      await renderSection();

      await screen.findByRole("status", { name: "Loading body fat and lean mass" });
      // The failed read has answered by now, and the one that hangs holds the status.
      await waitFor(() => {
        expect(weightBackend.bodyRequestCount.lean_mass_kg).toBeGreaterThan(0);
      });

      expect(
        screen.getByRole("status", { name: "Loading body fat and lean mass" }),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });
  });

  describe("when the readings cannot be read", () => {
    beforeEach(() => {
      weightBackend.bodyMeasurements = leanMassSeries();
      weightBackend.bodyReadsFail.body_fat_pct = true;
    });

    it("should say so as an alert and offer Try again", async () => {
      await renderSection();

      const alert = await screen.findByRole("alert", {
        name: /Couldn't load body fat and lean mass/,
      });

      expect(within(alert).getByText("Check your connection and try again.")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Try again" })).toBeOnTheScreen();
    });

    it("should read again only the kind that failed, and show the cards when it works", async () => {
      await renderSection();
      await screen.findByRole("alert", { name: /Couldn't load body fat and lean mass/ });
      const requestsBefore = { ...weightBackend.bodyRequestCount };
      weightBackend.bodyReadsFail.body_fat_pct = false;
      weightBackend.bodyMeasurements = [...bodyFatSeries(), ...leanMassSeries()];

      await userEvent.setup().press(screen.getByRole("button", { name: "Try again" }));

      expect(await screen.findByLabelText("Body fat")).toBeOnTheScreen();
      expect(weightBackend.bodyRequestCount.body_fat_pct).toBe(requestsBefore.body_fat_pct + 1);
      expect(weightBackend.bodyRequestCount.lean_mass_kg).toBe(requestsBefore.lean_mass_kg);
    });
  });

  it("should not flash the skeleton when readings that are showing are read again", async () => {
    weightBackend.bodyMeasurements = [...bodyFatSeries(), ...leanMassSeries()];
    await renderSection();
    await screen.findByLabelText("Body fat");
    weightBackend.bodyReadsHang.body_fat_pct = true;
    weightBackend.bodyReadsHang.lean_mass_kg = true;

    void queryClient.refetchQueries();
    await waitFor(() => {
      expect(weightBackend.bodyRequestCount.body_fat_pct).toBe(2);
    });

    expect(screen.queryByRole("status")).not.toBeOnTheScreen();
    expect(screen.getByLabelText("Body fat")).toBeOnTheScreen();
    expect(screen.getByLabelText("Lean mass")).toBeOnTheScreen();
  });
});
