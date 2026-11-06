import {
  BODY_COMPOSITION,
  BODY_COMPOSITION_CHART,
  WEIGHT_RANGE_LABELS,
  WEIGHT_SCREEN,
} from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DESKTOP, FakeResizeObserver, stubSize } from "./chartSizeFakes";
import {
  bodyMeasurementSeries,
  renderWithWeight,
  resetWeightBackend,
  weighInRow,
  weightBackend,
} from "./support";

import { WeightScreen } from "@/components/weight";
import { resetWeightChartViewForTests } from "@/lib/weightChartView";

// Saturday 17 October 2026, 12:00 UTC.
const NOW = new Date("2026-10-17T12:00:00Z");
const TODAY = "2026-10-17";
const VIEW_KEY = "weight.chartView";
const UNIT_KEY = "weight.compositionUnit";

// 91 days at 80 kg, with body fat of 25 % so the split is 20 kg of fat and 60 kg of lean mass.
function seedReadings({ bodyFat = true, leanMass = true } = {}) {
  weightBackend.weighIns = Array.from({ length: 91 }, (_, index) => {
    const date = new Date(`${TODAY}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - index);

    return weighInRow({
      localDate: date.toISOString().slice(0, 10),
      utcTime: "07:10",
      weightKg: 80,
    });
  });
  weightBackend.bodyMeasurements = [
    ...(bodyFat
      ? bodyMeasurementSeries("body_fat_pct", {
          count: 91,
          lastLocalDate: TODAY,
          first: 25,
          last: 25,
        })
      : []),
    ...(leanMass
      ? bodyMeasurementSeries("lean_mass_kg", {
          count: 91,
          lastLocalDate: TODAY,
          first: 60,
          last: 60,
        })
      : []),
  ];
}

const viewGroup = () =>
  screen.findByRole("radiogroup", { name: BODY_COMPOSITION_CHART.viewGroupLabel });
const compositionFigure = () => screen.queryByRole("img", { name: /^Body fat and lean mass over/ });
const weightFigure = () => screen.queryByRole("img", { name: /^Weight over the last/ });

async function chooseView(view: "Weight" | "Composition") {
  fireEvent.click(within(await viewGroup()).getByRole("radio", { name: view }));
}

describe("the Weight or Composition view of the trend card", () => {
  beforeEach(() => {
    resetWeightBackend();
    window.localStorage.clear();
    resetWeightChartViewForTests();
    seedReadings();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    stubSize(DESKTOP);
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    onlineManager.setOnline(true);
    vi.useRealTimers();
  });

  describe("the Chart view switch", () => {
    it("should offer Weight and Composition, with Weight chosen first", async () => {
      renderWithWeight(<WeightScreen />);

      const group = await viewGroup();

      expect(within(group).getByRole("radio", { name: "Weight", checked: true })).toBeTruthy();
      expect(
        within(group).getByRole("radio", { name: "Composition", checked: false }),
      ).toBeTruthy();
    });

    it("should sit between the trend card and the range control", async () => {
      renderWithWeight(<WeightScreen />);

      const card = await screen.findByRole("region", { name: WEIGHT_SCREEN.trendCardName });
      const group = await viewGroup();
      const range = screen.getByRole("radiogroup", { name: WEIGHT_SCREEN.rangeGroupLabel });

      expect(card.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(group.compareDocumentPosition(range) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("should draw the weight chart and its legend, and no Composition figure, in the Weight view", async () => {
      renderWithWeight(<WeightScreen />);

      await viewGroup();

      expect(await screen.findByRole("img", { name: /^Weight over the last/ })).toBeTruthy();
      expect(screen.getByText(WEIGHT_SCREEN.legend.trend)).toBeTruthy();
      expect(compositionFigure()).toBeNull();
    });
  });

  describe("choosing Composition", () => {
    it("should replace the weight chart and its legend with the two line figure", async () => {
      renderWithWeight(<WeightScreen />);
      await chooseView("Composition");

      expect(
        await screen.findByRole("img", {
          name: "Body fat and lean mass over the last 90 days, body fat 20.0 kg, lean mass 60.0 kg",
        }),
      ).toBeTruthy();
      expect(weightFigure()).toBeNull();
      expect(screen.queryByText(WEIGHT_SCREEN.legend.trend)).toBeNull();
      expect(screen.getByRole("radiogroup", { name: WEIGHT_SCREEN.rangeGroupLabel })).toBeTruthy();
    });

    it("should keep the trend card as it was", async () => {
      renderWithWeight(<WeightScreen />);
      await chooseView("Composition");
      await screen.findByRole("img", { name: /^Body fat and lean mass over/ });

      const card = screen.getByRole("region", { name: WEIGHT_SCREEN.trendCardName });

      expect(within(card).getByText("80.0")).toBeTruthy();
    });

    it("should follow the range control", async () => {
      renderWithWeight(<WeightScreen />);
      await chooseView("Composition");
      await screen.findByRole("img", { name: /^Body fat and lean mass over the last 90 days/ });

      fireEvent.click(screen.getByRole("radio", { name: WEIGHT_RANGE_LABELS[7] }));

      expect(
        await screen.findByRole("img", { name: /^Body fat and lean mass over the last week/ }),
      ).toBeTruthy();
    });

    it("should change the values, and not the lines, with the kg and % switch", async () => {
      renderWithWeight(<WeightScreen />);
      await chooseView("Composition");
      await screen.findByRole("img", { name: /body fat 20\.0 kg/ });

      fireEvent.click(screen.getByRole("radio", { name: "%" }));

      expect(
        await screen.findByRole("img", { name: /body fat 25\.0 %, lean mass 75\.0 %$/ }),
      ).toBeTruthy();
    });

    it("should go back to the weight chart", async () => {
      renderWithWeight(<WeightScreen />);
      await chooseView("Composition");
      await screen.findByRole("img", { name: /^Body fat and lean mass over/ });

      await chooseView("Weight");

      expect(await screen.findByRole("img", { name: /^Weight over the last/ })).toBeTruthy();
      expect(compositionFigure()).toBeNull();
    });

    it("should draw the figure in the weight chart's box, so the switch does not move the page", async () => {
      renderWithWeight(<WeightScreen />);
      const weight = await screen.findByRole("img", { name: /^Weight over the last/ });
      const weightBox = [weight.className, weight.querySelector("svg")?.getAttribute("class")];

      await chooseView("Composition");
      const composition = await screen.findByRole("img", { name: /^Body fat and lean mass over/ });

      expect([
        composition.className,
        composition.querySelector("svg")?.getAttribute("class"),
      ]).toEqual(weightBox);
    });
  });

  describe("remembering the choice in this browser", () => {
    it("should save the view and the unit when they are chosen", async () => {
      renderWithWeight(<WeightScreen />);
      await chooseView("Composition");
      await screen.findByRole("img", { name: /^Body fat and lean mass over/ });
      fireEvent.click(screen.getByRole("radio", { name: "%" }));

      expect(window.localStorage.getItem(VIEW_KEY)).toBe("composition");
      expect(window.localStorage.getItem(UNIT_KEY)).toBe("pct");
    });

    it("should open on Composition in per cent after a reload", async () => {
      window.localStorage.setItem(VIEW_KEY, "composition");
      window.localStorage.setItem(UNIT_KEY, "pct");
      renderWithWeight(<WeightScreen />);

      expect(
        await screen.findByRole("img", { name: /body fat 25\.0 %, lean mass 75\.0 %$/ }),
      ).toBeTruthy();
      expect(
        within(await viewGroup()).getByRole("radio", { name: "Composition", checked: true }),
      ).toBeTruthy();
      expect(weightFigure()).toBeNull();
    });

    it("should open on Weight in a browser that saved nothing", async () => {
      renderWithWeight(<WeightScreen />);

      expect(await screen.findByRole("img", { name: /^Weight over the last/ })).toBeTruthy();
      expect(compositionFigure()).toBeNull();
    });
  });

  describe("the Body composition section under the figure", () => {
    it("should keep its heading and cards, with the lean mass caption once, under the figure", async () => {
      renderWithWeight(<WeightScreen />);
      await chooseView("Composition");
      await screen.findByRole("img", { name: /^Body fat and lean mass over/ });

      const section = await screen.findByRole("region", { name: BODY_COMPOSITION.heading });

      expect(within(section).getByRole("heading", { name: BODY_COMPOSITION.heading })).toBeTruthy();
      expect(await within(section).findByRole("region", { name: "Body fat" })).toBeTruthy();
      expect(within(section).getByRole("region", { name: "Lean mass" })).toBeTruthy();
      expect(screen.getAllByText(BODY_COMPOSITION.caption)).toHaveLength(1);
    });

    it("should keep the caption under the cards in the Weight view", async () => {
      renderWithWeight(<WeightScreen />);
      const section = await screen.findByRole("region", { name: BODY_COMPOSITION.heading });
      await within(section).findByRole("region", { name: "Lean mass" });

      expect(within(section).getByText(BODY_COMPOSITION.caption)).toBeTruthy();
    });

    it("should say there are no readings in the figure's place, and draw nothing, not even its heading, under it", async () => {
      seedReadings({ bodyFat: false, leanMass: false });
      renderWithWeight(<WeightScreen />);
      await chooseView("Composition");

      expect(await screen.findAllByText(BODY_COMPOSITION.noReadingsWeb)).toHaveLength(1);
      expect(screen.queryByRole("heading", { name: BODY_COMPOSITION.heading })).toBeNull();
      expect(screen.queryByRole("region", { name: BODY_COMPOSITION.heading })).toBeNull();
    });

    it("should draw the heading and the quiet line in the Weight view with no readings", async () => {
      seedReadings({ bodyFat: false, leanMass: false });
      renderWithWeight(<WeightScreen />);

      const section = await screen.findByRole("region", { name: BODY_COMPOSITION.heading });

      expect(await within(section).findByText(BODY_COMPOSITION.noReadingsWeb)).toBeTruthy();
    });

    it("should leave the loading shape to the figure's place while the readings load", async () => {
      weightBackend.bodyReadsHang = true;
      renderWithWeight(<WeightScreen />);
      await chooseView("Composition");

      const status = await screen.findByRole("status", { name: BODY_COMPOSITION.loadingLabel });

      expect(screen.getAllByRole("status", { name: BODY_COMPOSITION.loadingLabel })).toEqual([
        status,
      ]);
      expect(screen.queryByRole("heading", { name: BODY_COMPOSITION.heading })).toBeNull();
    });

    it("should leave the error state to the figure's place when the readings failed", async () => {
      weightBackend.bodyReadsFail = true;
      renderWithWeight(<WeightScreen />);
      await chooseView("Composition");

      const alert = await screen.findByRole("alert");

      expect(screen.getAllByRole("alert")).toEqual([alert]);
      expect(
        within(alert).getByRole("button", { name: BODY_COMPOSITION.error.retry }),
      ).toBeTruthy();
      expect(screen.queryByRole("heading", { name: BODY_COMPOSITION.heading })).toBeNull();
    });

    it("should draw the split and the cards of the kind that was read, when the other failed", async () => {
      seedReadings({ leanMass: false });
      weightBackend.bodyKindsFail = ["lean_mass_kg"];
      renderWithWeight(<WeightScreen />);
      await chooseView("Composition");

      expect(await screen.findByRole("img", { name: /^Body fat and lean mass over/ })).toBeTruthy();
      const section = await screen.findByRole("region", { name: BODY_COMPOSITION.heading });
      expect(await within(section).findByRole("region", { name: "Body fat" })).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.getAllByText(BODY_COMPOSITION.caption)).toHaveLength(1);
    });
  });

  describe("offline", () => {
    it("should keep the figure, the switch and the range working with readings already read", async () => {
      renderWithWeight(<WeightScreen />);
      await chooseView("Composition");
      await screen.findByRole("img", { name: /^Body fat and lean mass over/ });

      onlineManager.setOnline(false);
      fireEvent.click(screen.getByRole("radio", { name: WEIGHT_RANGE_LABELS[30] }));

      expect(
        await screen.findByRole("img", { name: /^Body fat and lean mass over the last 30 days/ }),
      ).toBeTruthy();
      fireEvent.click(screen.getByRole("radio", { name: "%" }));
      expect(await screen.findByRole("img", { name: /lean mass 75\.0 %$/ })).toBeTruthy();
    });
  });
});
