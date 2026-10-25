import "../support/gestureHandler";

import { KeyLowProvider, keys } from "@keylow/api-client";
import { addCalendarDays } from "@keylow/core/dates";
import { act, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { BodyCompositionView } from "../../components/BodyCompositionView";
import * as stories from "../../components/BodyCompositionView/BodyCompositionView.stories";
import { storyStates } from "../../components/BodyCompositionView/storyStates";
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

import type { BodyCompositionViewProps } from "../../components/BodyCompositionView";
import type { TrendPoint } from "@keylow/core/engine";
import type { QueryClient } from "@tanstack/react-query";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
// Skia draws nothing in Jest, so Victory never calls for the drawing. The chart's lines and points are views
// that keep the props they were given.
jest.mock("@shopify/react-native-skia", () => {
  const { createElement } = jest.requireActual<typeof import("react")>("react");
  const drawing = (name: string) => (props: object) => createElement(name, props);
  return {
    __esModule: true,
    Canvas: drawing("Canvas"),
    Path: drawing("Path"),
    Circle: drawing("Circle"),
    DashPathEffect: drawing("DashPathEffect"),
  };
});
// The chart calls its children with a point for each row and each series, and the lines and points it draws
// are views that keep the props they were given, so a test can read what would be drawn.
jest.mock("victory-native", () => {
  const { createElement } = jest.requireActual<typeof import("react")>("react");
  return {
    CartesianChart: (props: {
      data: ({ day: number } & Record<string, number | null>)[];
      yKeys: string[];
      children: (arguments_: { points: Record<string, unknown[]> }) => import("react").ReactNode;
    }) =>
      createElement(
        "CartesianChart",
        null,
        props.children({
          points: Object.fromEntries(
            props.yKeys.map((key) => [
              key,
              props.data.map((row) => ({
                x: row.day * 10,
                xValue: row.day,
                y: row[key] ?? null,
                yValue: row[key] ?? null,
              })),
            ]),
          ),
        }),
      ),
    Line: (props: object) => createElement("Line", props),
    Scatter: (props: object) => createElement("Scatter", props),
  };
});

setUpTests();

const today = "2026-10-17";
const bothAllowed = { bodyFat: true, leanMass: true };
const CAPTION = "Lean mass includes bone and water as well as muscle.";

type Kind = "body_fat_pct" | "lean_mass_kg";

// One reading a day for `days` days up to today, all the same value, so the trend sits on it.
function steadyReadings(kind: Kind, value: number, days: number) {
  return Array.from({ length: days }, (_, index) =>
    bodyMeasurementRow(kind, addCalendarDays(today, -index), value),
  );
}

// The weight trend the card gives the view: one point a day for the last `days` days, all at `trendKg`.
function steadyWeightTrend(trendKg: number, days = 100): TrendPoint[] {
  return Array.from({ length: days }, (_, index) => ({
    date: addCalendarDays(today, index + 1 - days),
    segment: 0,
    trendKg,
    rawKg: trendKg,
    usedKg: trendKg,
    rejected: false,
    winsorised: false,
    interpolated: false,
    nObs: index + 1,
  }));
}

// What a console call wrote, as text. An object is serialised, because String() turns it into "[object Object]".
function textOf(part: unknown): string {
  if (typeof part === "string") {
    return part;
  }
  try {
    // JSON.stringify answers undefined at run time for a function or undefined, which its type leaves out.
    const json: unknown = JSON.stringify(part);
    return typeof json === "string" ? json : String(part);
  } catch {
    return String(part);
  }
}

let queryClient: QueryClient;

function viewOver(props: Partial<BodyCompositionViewProps>) {
  return (
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={weightClient} queryClient={queryClient}>
        <BodyCompositionView
          access={bothAllowed}
          connection="connected"
          range={90}
          today={today}
          unit="kg"
          weightPoints={steadyWeightTrend(83.1)}
          onUnitChange={jest.fn()}
          {...props}
        />
      </KeyLowProvider>
    </ThemeProvider>
  );
}

async function renderView(props: Partial<BodyCompositionViewProps> = {}) {
  const view = await render(viewOver(props));

  return {
    rerenderWith: (next: Partial<BodyCompositionViewProps>) =>
      view.rerender(viewOver({ ...props, ...next })),
  };
}

describe("BodyCompositionView", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/BodyCompositionView",
      "components/BodyCompositionChart",
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
    jest.restoreAllMocks();
  });

  describe("body fat drives, in kilograms", () => {
    beforeEach(() => {
      weightBackend.bodyMeasurements = steadyReadings("body_fat_pct", 21.9, 100);
    });

    it("should draw the figure named by the latest split in kilograms", async () => {
      await renderView();

      expect(
        await screen.findByRole("img", {
          name: "Body fat and lean mass over the last 90 days, body fat 18.2 kg, lean mass 64.9 kg",
        }),
      ).toBeOnTheScreen();
    });

    it("should name the reading the split was worked out from", async () => {
      await renderView();

      expect(
        await screen.findByText("Worked out from your body fat and trend weight."),
      ).toBeOnTheScreen();
    });

    it("should show the lean mass caption under the figure", async () => {
      await renderView();

      expect(await screen.findByText(CAPTION)).toBeOnTheScreen();
    });

    it("should offer Show as with kg chosen", async () => {
      await renderView();

      await screen.findByRole("img");

      // The role query does not resolve a radiogroup, so the group is found by its name and checked for its role.
      expect(screen.getByLabelText("Show as")).toHaveProp("role", "radiogroup");
      expect(screen.getByRole("radio", { name: "kg", checked: true })).toBeOnTheScreen();
      expect(screen.getByRole("radio", { name: "%", checked: false })).toBeOnTheScreen();
    });

    it("should report % when it is pressed", async () => {
      const onUnitChange = jest.fn();
      await renderView({ onUnitChange });
      await screen.findByRole("img");

      await userEvent.setup().press(screen.getByRole("radio", { name: "%" }));

      expect(onUnitChange).toHaveBeenCalledWith("pct");
    });
  });

  describe("in per cent", () => {
    it("should name the latest split in per cent", async () => {
      weightBackend.bodyMeasurements = steadyReadings("body_fat_pct", 22.4, 100);

      await renderView({ unit: "pct" });

      expect(
        await screen.findByRole("img", {
          name: "Body fat and lean mass over the last 90 days, body fat 22.4 %, lean mass 77.6 %",
        }),
      ).toBeOnTheScreen();
      expect(screen.getByRole("radio", { name: "%", checked: true })).toBeOnTheScreen();
    });
  });

  describe("lean mass only", () => {
    beforeEach(() => {
      weightBackend.bodyMeasurements = steadyReadings("lean_mass_kg", 63.1, 100);
    });

    it("should say the split was worked out from lean mass", async () => {
      await renderView({ weightPoints: steadyWeightTrend(81.3) });

      expect(
        await screen.findByText("Worked out from your lean mass and trend weight."),
      ).toBeOnTheScreen();
    });

    it("should still name both values", async () => {
      await renderView({ weightPoints: steadyWeightTrend(81.3) });

      expect(
        await screen.findByRole("img", {
          name: "Body fat and lean mass over the last 90 days, body fat 18.2 kg, lean mass 63.1 kg",
        }),
      ).toBeOnTheScreen();
    });

    it("should show the lean mass caption under the figure", async () => {
      await renderView({ weightPoints: steadyWeightTrend(81.3) });

      expect(await screen.findByText(CAPTION)).toBeOnTheScreen();
    });

    it("should not draw the prompt for the other kind, which the section under the card holds", async () => {
      await renderView({
        access: { bodyFat: false, leanMass: true },
        weightPoints: steadyWeightTrend(81.3),
      });

      await screen.findByRole("img");

      expect(screen.queryByText("Ki-Lo can't read body fat yet.")).not.toBeOnTheScreen();
    });
  });
  describe("when one kind is not settled yet", () => {
    beforeEach(() => {
      weightBackend.bodyMeasurements = steadyReadings("lean_mass_kg", 63.1, 100);
    });

    it("should show the loading status, and no figure, while body fat is still being read", async () => {
      weightBackend.bodyReadsHang.body_fat_pct = true;

      await renderView({ weightPoints: steadyWeightTrend(81.3) });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });

      expect(
        screen.getByRole("status", { name: "Loading body fat and lean mass" }),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("img")).not.toBeOnTheScreen();
    });

    it("should draw the figure from lean mass, and no alert, when body fat failed to load", async () => {
      weightBackend.bodyReadsFail.body_fat_pct = true;

      await renderView({ weightPoints: steadyWeightTrend(81.3) });

      expect(await screen.findByRole("img")).toBeOnTheScreen();
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });
  });

  describe("over a week", () => {
    it("should name the figure by the last week", async () => {
      weightBackend.bodyMeasurements = steadyReadings("body_fat_pct", 21.9, 100);

      await renderView({ range: 7 });

      expect(
        await screen.findByRole("img", {
          name: "Body fat and lean mass over the last week, body fat 18.2 kg, lean mass 64.9 kg",
        }),
      ).toBeOnTheScreen();
    });
  });

  describe("the lines", () => {
    const dashes = () =>
      (screen.root?.queryAll((node) => node.type === "Line") ?? []).map((line) => {
        const effect: unknown = line.props.children;
        return typeof effect === "object" && effect !== null && "props" in effect
          ? effect.props
          : null;
      });

    it("should dash both lines, 5 on and 4 off, while the trend settles", async () => {
      weightBackend.bodyMeasurements = steadyReadings("body_fat_pct", 21.9, 3);

      await renderView();
      await screen.findByRole("img");

      expect(dashes()).toEqual([{ intervals: [5, 4] }, { intervals: [5, 4] }]);
    });

    it("should draw both lines solid once the trend has settled", async () => {
      weightBackend.bodyMeasurements = steadyReadings("body_fat_pct", 21.9, 100);

      await renderView();
      await screen.findByRole("img");

      expect(dashes()).toEqual([null, null]);
    });
  });

  describe("settling", () => {
    it("should show Settling and still draw the figure with 3 body fat readings", async () => {
      weightBackend.bodyMeasurements = steadyReadings("body_fat_pct", 21.9, 3);

      await renderView();

      expect(await screen.findByRole("img")).toBeOnTheScreen();
      expect(screen.getByText("Settling")).toBeOnTheScreen();
    });

    it("should not show Settling with 7 body fat readings", async () => {
      weightBackend.bodyMeasurements = steadyReadings("body_fat_pct", 21.9, 7);

      await renderView();

      await screen.findByRole("img");

      expect(screen.queryByText("Settling")).not.toBeOnTheScreen();
    });
  });

  describe("prompts", () => {
    const addAll = "Add body fat and lean mass";

    it("should open Health Connect access from the not-allowed prompt when not connected", async () => {
      await renderView({ connection: "not-connected", access: null });

      expect(screen.getByText("See body fat and lean mass here")).toBeOnTheScreen();

      await userEvent.setup().press(screen.getByRole("button", { name: addAll }));

      expect(routerMock.push).toHaveBeenCalledWith("/more/weight/health");
    });

    it("should open the body composition permission flow when connected with neither kind allowed", async () => {
      await renderView({ access: { bodyFat: false, leanMass: false } });

      await userEvent.setup().press(screen.getByRole("button", { name: addAll }));

      expect(routerMock.push).toHaveBeenCalledWith("/more/weight/health?add=body-composition");
    });

    it("should show the loading status while access is not known", async () => {
      await renderView({ access: null });

      expect(
        screen.getByRole("status", { name: "Loading body fat and lean mass" }),
      ).toBeOnTheScreen();
    });

    it("should show the loading status while an allowed kind is still being read", async () => {
      weightBackend.bodyReadsHang.body_fat_pct = true;

      await renderView();

      expect(
        screen.getByRole("status", { name: "Loading body fat and lean mass" }),
      ).toBeOnTheScreen();
    });

    it("should read the failed kind again from Try again", async () => {
      weightBackend.bodyReadsFail.body_fat_pct = true;
      await renderView();
      expect(await screen.findByRole("alert")).toBeOnTheScreen();
      expect(screen.getByText("Couldn't load body fat and lean mass")).toBeOnTheScreen();
      const bodyFatReads = weightBackend.bodyRequestCount.body_fat_pct;
      const leanMassReads = weightBackend.bodyRequestCount.lean_mass_kg;

      await userEvent.setup().press(screen.getByRole("button", { name: "Try again" }));

      await waitFor(() => {
        expect(weightBackend.bodyRequestCount.body_fat_pct).toBe(bodyFatReads + 1);
      });
      expect(weightBackend.bodyRequestCount.lean_mass_kg).toBe(leanMassReads);
    });

    it("should say there are no readings yet when both kinds are allowed and empty", async () => {
      await renderView();

      expect(await screen.findByText("No body fat or lean mass readings yet")).toBeOnTheScreen();
    });

    it("should show none of the figure's controls with a prompt", async () => {
      await renderView({ access: { bodyFat: false, leanMass: false } });

      expect(screen.queryByLabelText("Show as")).not.toBeOnTheScreen();
      expect(screen.queryByText(CAPTION)).not.toBeOnTheScreen();
    });
  });

  describe("a read while data shows", () => {
    it("should keep the figure and not show the loading status", async () => {
      weightBackend.bodyMeasurements = steadyReadings("body_fat_pct", 21.9, 100);
      await renderView();
      await screen.findByRole("img");
      weightBackend.bodyReadsHang.body_fat_pct = true;

      await act(async () => {
        // The read never answers, so it is started and not waited for.
        void queryClient.invalidateQueries({ queryKey: keys.bodyMeasurements.all });
        await new Promise((resolve) => setTimeout(resolve, 20));
      });

      expect(screen.getByRole("img")).toBeOnTheScreen();
      expect(screen.queryByRole("status")).not.toBeOnTheScreen();
    });
  });

  describe("every state", () => {
    const states: readonly [string, () => void, Partial<BodyCompositionViewProps>][] = [
      [
        "figure in kilograms",
        () => {
          weightBackend.bodyMeasurements = steadyReadings("body_fat_pct", 21.9, 100);
        },
        {},
      ],
      [
        "settling figure in per cent",
        () => {
          weightBackend.bodyMeasurements = steadyReadings("lean_mass_kg", 63.1, 3);
        },
        { unit: "pct", weightPoints: steadyWeightTrend(81.3) },
      ],
      ["not allowed", () => undefined, { connection: "not-connected" }],
      ["loading", () => undefined, { access: null }],
      [
        "error",
        () => {
          weightBackend.bodyReadsFail.body_fat_pct = true;
          weightBackend.bodyReadsFail.lean_mass_kg = true;
        },
        {},
      ],
      ["no readings yet", () => undefined, {}],
    ];

    it.each(states)(
      "should say lean mass, never muscle, and name no Apple service in %s",
      async (_name, arrange, props) => {
        arrange();

        await renderView(props);
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
        });
        const words = screenWords().filter((word) => word !== CAPTION);
        expect(words.length).toBeGreaterThan(0);
        for (const word of words) {
          expect(word).not.toMatch(/muscle|apple|healthkit|icloud/i);
        }
      },
    );

    it.each(states)(
      "should write no body fat, lean mass or weight value to the console in %s",
      async (_name, arrange, props) => {
        const written: string[] = [];
        for (const level of ["log", "info", "warn", "error"] as const) {
          jest.spyOn(console, level).mockImplementation((...parts: unknown[]) => {
            written.push(parts.map(textOf).join(" "));
          });
        }
        arrange();

        await renderView(props);
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
        });

        const text = written.join("\n");
        // A value is matched by its whole part and the dot, so a long float such as 18.199999 is caught too.
        expect(text).not.toMatch(/\b(18|21|22|63|64|77|81|83)\.\d/);
      },
    );
  });
  it("should have a story for each state it lists, and no other", () => {
    expect(
      Object.keys(stories)
        .filter((name) => name !== "default")
        .sort(),
    ).toEqual([...storyStates].sort());
  });
});
