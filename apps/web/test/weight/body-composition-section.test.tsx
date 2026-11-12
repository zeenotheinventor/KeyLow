import { BODY_COMPOSITION, WEIGHT_RANGE_LABELS, WEIGHT_SCREEN } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  LEAKY_DATABASE_MESSAGE,
  bodyMeasurementSeries,
  renderWithWeight,
  resetWeightBackend,
  weighInRow,
  weightBackend,
} from "./support";

import type { WeightRange } from "@keylow/core/weight";

import { WeightScreen } from "@/components/weight";
import { BodyCompositionSection } from "@/components/weight/BodyCompositionSection";

// Saturday 17 October 2026, 12:00 UTC.
const NOW = new Date("2026-10-17T12:00:00Z");
const TODAY = "2026-10-17";

// The boards' own series: a long fall that the trend reads as body fat 22.4 % and lean mass 63.1 kg, down
// 0.6 points and 0.2 kg over 90 days.
const goldenBodyFat = () =>
  bodyMeasurementSeries("body_fat_pct", {
    count: 91,
    lastLocalDate: TODAY,
    first: 22.94,
    last: 22.29,
  });
const goldenLeanMass = () =>
  bodyMeasurementSeries("lean_mass_kg", {
    count: 91,
    lastLocalDate: TODAY,
    first: 63.28,
    last: 63.03,
  });

function renderSection(range: WeightRange = 90) {
  return renderWithWeight(<BodyCompositionSection range={range} today={TODAY} />);
}

const card = (name: string) => screen.findByRole("region", { name });
const noReadingsLine = () => screen.queryByText(BODY_COMPOSITION.noReadingsWeb);

describe("BodyCompositionSection", () => {
  beforeEach(() => {
    resetWeightBackend();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    cleanup();
    onlineManager.setOnline(true);
    vi.useRealTimers();
  });

  describe("with both kinds read", () => {
    beforeEach(() => {
      weightBackend.bodyMeasurements = [...goldenBodyFat(), ...goldenLeanMass()];
    });

    it("should be a region headed Body composition with a card for each kind", async () => {
      renderSection();

      const section = await screen.findByRole("region", { name: BODY_COMPOSITION.heading });

      expect(
        within(section).getByRole("heading", { level: 2, name: BODY_COMPOSITION.heading }),
      ).toBeTruthy();
      expect(await within(section).findByRole("region", { name: "Body fat" })).toBeTruthy();
      expect(within(section).getByRole("region", { name: "Lean mass" })).toBeTruthy();
    });

    it("should read the boards' golden body fat: 22.4 %, down 0.6 points over 90 days", async () => {
      renderSection();

      const bodyFat = within(await card("Body fat"));

      expect(bodyFat.getByText("22.4")).toBeTruthy();
      expect(bodyFat.getByText("%")).toBeTruthy();
      expect(bodyFat.getByText("−0.6 points over 90 days")).toBeTruthy();
      expect(
        bodyFat.getByRole("img", { name: "Body fat over the last 90 days, trend 22.4 %" }),
      ).toBeTruthy();
    });

    it("should read the boards' golden lean mass: 63.1 kg, down 0.2 kg over 90 days", async () => {
      renderSection();

      const leanMass = within(await card("Lean mass"));

      expect(leanMass.getByText("63.1")).toBeTruthy();
      expect(leanMass.getByText("kg")).toBeTruthy();
      expect(leanMass.getByText("−0.2 kg over 90 days")).toBeTruthy();
      expect(
        leanMass.getByRole("img", { name: "Lean mass over the last 90 days, trend 63.1 kg" }),
      ).toBeTruthy();
    });

    it("should say that lean mass includes bone and water, under the cards", async () => {
      renderSection();
      await card("Lean mass");

      expect(screen.getByText(BODY_COMPOSITION.caption)).toBeTruthy();
    });

    it("should word the change and the line for the range it is given", async () => {
      renderSection(30);

      const bodyFat = within(await card("Body fat"));

      expect(bodyFat.getByText(/points over 30 days$/)).toBeTruthy();
      expect(bodyFat.getByRole("img", { name: /^Body fat over the last 30 days/ })).toBeTruthy();
    });

    it("should draw the cards side by side from the large breakpoint", async () => {
      renderSection();
      const bodyFat = await card("Body fat");

      expect(bodyFat.parentElement?.className).toContain("lg:grid-cols-2");
    });

    it("should write no value to the console", async () => {
      const spies = (["log", "info", "warn", "error"] as const).map((level) =>
        vi.spyOn(console, level).mockImplementation(() => undefined),
      );
      renderSection();
      await card("Body fat");

      for (const spy of spies) {
        expect(spy).not.toHaveBeenCalled();
      }
    });
  });

  describe("with one kind read", () => {
    it("should draw body fat alone, across the column, with no caption", async () => {
      weightBackend.bodyMeasurements = goldenBodyFat();
      renderSection();

      const bodyFat = await card("Body fat");

      expect(screen.queryByRole("region", { name: "Lean mass" })).toBeNull();
      expect(screen.queryByText(BODY_COMPOSITION.caption)).toBeNull();
      expect(noReadingsLine()).toBeNull();
      expect(bodyFat.parentElement?.className).not.toContain("lg:grid-cols-2");
    });

    it("should draw lean mass alone with the caption", async () => {
      weightBackend.bodyMeasurements = goldenLeanMass();
      renderSection();

      await card("Lean mass");

      expect(screen.queryByRole("region", { name: "Body fat" })).toBeNull();
      expect(screen.getByText(BODY_COMPOSITION.caption)).toBeTruthy();
      expect(noReadingsLine()).toBeNull();
    });
  });

  describe("with a trend that is still settling", () => {
    beforeEach(() => {
      weightBackend.bodyMeasurements = [
        ...bodyMeasurementSeries("body_fat_pct", {
          count: 3,
          lastLocalDate: TODAY,
          first: 22.1,
          last: 22.4,
        }),
      ];
    });

    it("should have the Settling badge, the count so far and no change", async () => {
      renderSection();

      const bodyFat = within(await card("Body fat"));

      expect(bodyFat.getByText(WEIGHT_SCREEN.settlingBadge)).toBeTruthy();
      expect(bodyFat.getByText("Settles after 7 readings. 3 of 7 so far.")).toBeTruthy();
      expect(bodyFat.queryByText(/over 90 days$/)).toBeNull();
    });

    it("should draw the line, placed by date", async () => {
      renderSection();

      const bodyFat = within(await card("Body fat"));

      expect(bodyFat.getByRole("img", { name: /^Body fat over the last 90 days/ })).toBeTruthy();
    });
  });

  describe("with fewer than two readings in the range", () => {
    beforeEach(() => {
      weightBackend.bodyMeasurements = bodyMeasurementSeries("lean_mass_kg", {
        count: 40,
        lastLocalDate: "2026-09-27",
        first: 63.5,
        last: 63.1,
      });
    });

    it("should be the value and the reason, with no badge and no line", async () => {
      renderSection(7);

      const leanMass = within(await card("Lean mass"));

      expect(leanMass.getByText("63.2")).toBeTruthy();
      expect(
        leanMass.getByText("Not enough readings in the last week to show a change."),
      ).toBeTruthy();
      expect(leanMass.queryByRole("img")).toBeNull();
      expect(leanMass.queryByText(/over 1 week$/)).toBeNull();
      expect(leanMass.queryByText(WEIGHT_SCREEN.settlingBadge)).toBeNull();
    });
  });

  describe("with no readings of either kind", () => {
    it("should be the heading over one quiet line, with no permission, link or action", async () => {
      renderSection();

      const section = await screen.findByRole("region", { name: BODY_COMPOSITION.heading });
      await waitFor(() => {
        expect(noReadingsLine()).toBeTruthy();
      });

      expect(within(section).queryByRole("button")).toBeNull();
      expect(within(section).queryByRole("link")).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
      expect(screen.queryByText(BODY_COMPOSITION.caption)).toBeNull();
    });

    it("should say where the readings come from, in the one string the web has", () => {
      expect(BODY_COMPOSITION.noReadingsWeb).toBe(
        "No body fat or lean mass readings yet. They come from a smart scale, through Health Connect in the Ki-Lo phone app.",
      );
    });
  });

  describe("while the readings load", () => {
    it("should be one status region named Loading body fat and lean mass, under the heading", async () => {
      weightBackend.bodyReadsHang = true;
      renderSection();

      const status = await screen.findByRole("status", { name: BODY_COMPOSITION.loadingLabel });

      expect(screen.getByRole("heading", { name: BODY_COMPOSITION.heading })).toBeTruthy();
      expect(status).toBeTruthy();
      expect(screen.queryByRole("region", { name: "Body fat" })).toBeNull();
      expect(noReadingsLine()).toBeNull();
    });
  });

  describe("when the read fails", () => {
    it("should be the error state with Try again, and nothing from the database", async () => {
      weightBackend.bodyReadsFail = true;
      renderSection();

      const alert = await screen.findByRole("alert");

      expect(
        within(alert).getByRole("heading", { level: 2, name: BODY_COMPOSITION.error.title }),
      ).toBeTruthy();
      expect(within(alert).getByText(BODY_COMPOSITION.error.body)).toBeTruthy();
      expect(
        within(alert).getByRole("button", { name: BODY_COMPOSITION.error.retry }),
      ).toBeTruthy();
      expect(document.body.textContent).not.toContain(LEAKY_DATABASE_MESSAGE);
    });

    it("should read the failed kinds again when Try again is pressed, and show the cards when that works", async () => {
      weightBackend.bodyMeasurements = [...goldenBodyFat(), ...goldenLeanMass()];
      weightBackend.bodyReadsFail = true;
      renderSection();
      fireEvent.click(await screen.findByRole("button", { name: BODY_COMPOSITION.error.retry }));
      await screen.findByRole("alert");
      const requestsBefore = weightBackend.bodyRequestCount;

      weightBackend.bodyReadsFail = false;
      fireEvent.click(screen.getByRole("button", { name: BODY_COMPOSITION.error.retry }));

      expect(await card("Body fat")).toBeTruthy();
      expect(await card("Lean mass")).toBeTruthy();
      expect(weightBackend.bodyRequestCount).toBe(requestsBefore + 2);
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("when one kind failed and the other has readings", () => {
    it("should be the error state in place of the card, and Try again reads only the failed kind", async () => {
      weightBackend.bodyMeasurements = goldenBodyFat();
      weightBackend.bodyKindsFail = ["lean_mass_kg"];
      renderSection();

      const alert = await screen.findByRole("alert");
      await waitFor(() => {
        expect(weightBackend.bodyRequestCountByKind.body_fat_pct).toBeGreaterThan(0);
      });
      expect(screen.queryByRole("region", { name: "Body fat" })).toBeNull();
      const before = { ...weightBackend.bodyRequestCountByKind };

      fireEvent.click(within(alert).getByRole("button", { name: BODY_COMPOSITION.error.retry }));

      await waitFor(() => {
        expect(weightBackend.bodyRequestCountByKind.lean_mass_kg).toBe(
          (before.lean_mass_kg ?? 0) + 1,
        );
      });
      expect(weightBackend.bodyRequestCountByKind.body_fat_pct).toBe(before.body_fat_pct);
    });
  });

  describe("offline", () => {
    it("should be the error state with no Try again and no loading shapes when nothing was read", async () => {
      onlineManager.setOnline(false);
      renderSection();

      const alert = await screen.findByRole("alert");

      expect(
        within(alert).getByRole("heading", { level: 2, name: BODY_COMPOSITION.error.title }),
      ).toBeTruthy();
      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("should show the cards by itself when the connection returns", async () => {
      weightBackend.bodyMeasurements = goldenBodyFat();
      onlineManager.setOnline(false);
      renderSection();
      await screen.findByRole("alert");

      act(() => {
        onlineManager.setOnline(true);
      });

      expect(await card("Body fat")).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("should keep readings already read as they are, with no banner and no notice", async () => {
      weightBackend.bodyMeasurements = [...goldenBodyFat(), ...goldenLeanMass()];
      renderSection();
      await card("Body fat");

      act(() => {
        onlineManager.setOnline(false);
      });

      expect(screen.getByRole("region", { name: "Body fat" })).toBeTruthy();
      expect(screen.getByRole("region", { name: "Lean mass" })).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
    });
  });
});

describe("the Weight page with body composition", () => {
  beforeEach(() => {
    resetWeightBackend();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    weightBackend.weighIns = [
      weighInRow({ localDate: "2026-10-17", utcTime: "07:10", weightKg: 81.4 }),
      weighInRow({ localDate: "2026-10-16", utcTime: "07:10", weightKg: 81.8 }),
    ];
    weightBackend.bodyMeasurements = [...goldenBodyFat(), ...goldenLeanMass()];
  });

  afterEach(() => {
    cleanup();
    onlineManager.setOnline(true);
    vi.useRealTimers();
  });

  it("should draw the section under the chart's legend and before the weigh-ins, in the first column", async () => {
    renderWithWeight(<WeightScreen />);

    const section = await screen.findByRole("region", { name: BODY_COMPOSITION.heading });
    const legend = screen.getByText(WEIGHT_SCREEN.legend.leftOut);
    const list = screen.getByRole("region", { name: "Weigh-ins" });

    expect(legend.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(section.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("should word the cards for the range the page's range control chooses", async () => {
    renderWithWeight(<WeightScreen />);
    const bodyFat = within(await card("Body fat"));
    expect(bodyFat.getByText("−0.6 points over 90 days")).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: WEIGHT_RANGE_LABELS[30] }));

    await waitFor(() => {
      expect(bodyFat.getByText(/points over 30 days$/)).toBeTruthy();
    });
    expect(bodyFat.queryByText(/over 90 days$/)).toBeNull();
    expect(bodyFat.getByRole("img", { name: /^Body fat over the last 30 days/ })).toBeTruthy();
  });

  it("should draw no section while the page has no weigh-ins", async () => {
    weightBackend.weighIns = [];
    renderWithWeight(<WeightScreen />);
    await screen.findByRole("heading", { level: 2 });

    expect(screen.queryByRole("region", { name: BODY_COMPOSITION.heading })).toBeNull();
  });
});
