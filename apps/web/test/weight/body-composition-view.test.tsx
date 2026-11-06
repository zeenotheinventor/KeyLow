import { keys, useWeightTrend } from "@keylow/api-client";
import { BODY_COMPOSITION, BODY_COMPOSITION_CHART, WEIGHT_SCREEN } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DESKTOP, FakeResizeObserver, stubSize } from "./chartSizeFakes";
import {
  LEAKY_DATABASE_MESSAGE,
  bodyMeasurementSeries,
  createWeightQueryClient,
  renderWithWeight,
  resetWeightBackend,
  weighInRow,
  weightBackend,
} from "./support";

import type { BodySplitUnit, WeightRange } from "@keylow/core/weight";

import { BodyCompositionView } from "@/components/weight/BodyCompositionView";

// Saturday 17 October 2026, 12:00 UTC.
const NOW = new Date("2026-10-17T12:00:00Z");
const TODAY = "2026-10-17";

// 91 days at 80 kg, so body fat of 25 % is 20 kg of fat and 60 kg of lean mass whatever day is read.
function steadyWeighIns() {
  return Array.from({ length: 91 }, (_, index) => {
    const date = new Date(`${TODAY}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - index);

    return weighInRow({
      localDate: date.toISOString().slice(0, 10),
      utcTime: "07:10",
      weightKg: 80,
    });
  });
}

const steadyBodyFat = (count = 91) =>
  bodyMeasurementSeries("body_fat_pct", { count, lastLocalDate: TODAY, first: 25, last: 25 });
const steadyLeanMass = (count = 91) =>
  bodyMeasurementSeries("lean_mass_kg", { count, lastLocalDate: TODAY, first: 60, last: 60 });

type HarnessProps = {
  range?: WeightRange;
  unit?: BodySplitUnit;
  onUnitChange?: (unit: BodySplitUnit) => void;
};

// The page reads the weigh-ins and works the trend out, and gives it to the view, so the view's tests do.
function Harness({ range = 90, unit = "kg", onUnitChange = () => undefined }: HarnessProps) {
  const trend = useWeightTrend();

  return (
    <BodyCompositionView
      weightPoints={trend.points}
      range={range}
      today={TODAY}
      unit={unit}
      onUnitChange={onUnitChange}
    />
  );
}

const renderView = (props: HarnessProps = {}) => renderWithWeight(<Harness {...props} />);
const figure = () => screen.findByRole("img", { name: /^Body fat and lean mass over/ });

describe("BodyCompositionView", () => {
  beforeEach(() => {
    resetWeightBackend();
    weightBackend.weighIns = steadyWeighIns();
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

  describe("with body fat readings", () => {
    beforeEach(() => {
      weightBackend.bodyMeasurements = [...steadyBodyFat(), ...steadyLeanMass()];
    });

    it("should draw one image that names the span and both latest values in kilograms", async () => {
      renderView();

      expect(
        await screen.findByRole("img", {
          name: "Body fat and lean mass over the last 90 days, body fat 20.0 kg, lean mass 60.0 kg",
        }),
      ).toBeTruthy();
    });

    it("should name the values in per cent of the trend weight, which add up to 100", async () => {
      renderView({ unit: "pct" });

      expect(
        await screen.findByRole("img", {
          name: "Body fat and lean mass over the last 90 days, body fat 25.0 %, lean mass 75.0 %",
        }),
      ).toBeTruthy();
    });

    it("should name the range it is given", async () => {
      renderView({ range: 7 });

      expect(
        await screen.findByRole("img", { name: /^Body fat and lean mass over the last week,/ }),
      ).toBeTruthy();
    });

    it("should say the lines were worked out from body fat and the trend weight", async () => {
      renderView();
      await figure();

      expect(screen.getByText("Worked out from your body fat and trend weight.")).toBeTruthy();
      expect(screen.getByText(BODY_COMPOSITION.caption)).toBeTruthy();
    });

    it("should offer kg and % in a group named Show as, with the unit it is given chosen", async () => {
      renderView({ unit: "pct" });
      await figure();

      const group = screen.getByRole("radiogroup", { name: BODY_COMPOSITION_CHART.unitGroupLabel });

      expect(within(group).getByRole("radio", { name: "%", checked: true })).toBeTruthy();
      expect(within(group).getByRole("radio", { name: "kg", checked: false })).toBeTruthy();
    });

    it("should tell the screen which unit was pressed, and leave the figure to the unit it is given", async () => {
      const onUnitChange = vi.fn();
      renderView({ onUnitChange });
      await figure();

      fireEvent.click(screen.getByRole("radio", { name: "%" }));

      expect(onUnitChange).toHaveBeenCalledExactlyOnceWith("pct");
      expect(screen.getByRole("img", { name: /body fat 20\.0 kg/ })).toBeTruthy();
    });

    it("should draw no Settling badge once the trend has settled", async () => {
      renderView();
      await figure();

      expect(screen.queryByText(WEIGHT_SCREEN.settlingBadge)).toBeNull();
      const lines = Array.from(document.querySelectorAll("figure path"));
      expect(lines).toHaveLength(2);
      expect(lines.every((line) => !(line.getAttribute("class") ?? "").includes("dasharray"))).toBe(
        true,
      );
    });

    it("should write no reading to the console", async () => {
      const spies = (["log", "info", "warn", "error"] as const).map((level) =>
        vi.spyOn(console, level).mockImplementation(() => undefined),
      );
      renderView();
      await figure();

      for (const spy of spies) {
        expect(spy).not.toHaveBeenCalled();
      }
    });
  });

  describe("while only one of the two kinds has loaded", () => {
    it("should wait online for the kind still loading, then draw the split once it arrives", async () => {
      weightBackend.bodyMeasurements = [...steadyBodyFat(), ...steadyLeanMass()];
      let arrive: () => void = () => undefined;
      weightBackend.bodyKindGates.body_fat_pct = new Promise<void>((resolve) => {
        arrive = resolve;
      });
      // Lean mass answers late, so the wait below has to be for its data and not for its request.
      weightBackend.bodyKindGates.lean_mass_kg = new Promise<void>((resolve) => {
        setTimeout(resolve, 100);
      });
      const queryClient = createWeightQueryClient();
      renderWithWeight(<Harness />, queryClient);

      await screen.findByRole("status", { name: BODY_COMPOSITION.loadingLabel });
      // Lean mass is in the cache, so it could be drawn on its own, but body fat drives once it arrives.
      await waitFor(() => {
        expect(queryClient.getQueryData(keys.bodyMeasurements.list("lean_mass_kg"))).toBeDefined();
      });
      expect(queryClient.getQueryData(keys.bodyMeasurements.list("body_fat_pct"))).toBeUndefined();
      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.getByRole("status", { name: BODY_COMPOSITION.loadingLabel })).toBeTruthy();
      expect(screen.queryByRole("img")).toBeNull();

      arrive();

      expect(await figure()).toBeTruthy();
      expect(screen.getByText("Worked out from your body fat and trend weight.")).toBeTruthy();
      expect(screen.queryByRole("status")).toBeNull();
    });
  });

  describe("settling", () => {
    it("should show the Settling badge and dash both lines while body fat has too few readings", async () => {
      weightBackend.bodyMeasurements = [...steadyBodyFat(3), ...steadyLeanMass(3)];
      renderView({ range: 7 });
      await figure();

      expect(screen.getByText(WEIGHT_SCREEN.settlingBadge)).toBeTruthy();
      const lines = Array.from(document.querySelectorAll("figure path"));
      expect(lines).toHaveLength(2);
      for (const line of lines) {
        expect(line.getAttribute("class")).toContain("[stroke-dasharray:5_4]");
      }
    });
  });

  describe("with lean mass readings only", () => {
    it("should work the split out from the lean mass, and say so", async () => {
      weightBackend.bodyMeasurements = steadyLeanMass();
      renderView();

      expect(
        await screen.findByRole("img", {
          name: "Body fat and lean mass over the last 90 days, body fat 20.0 kg, lean mass 60.0 kg",
        }),
      ).toBeTruthy();
      expect(screen.getByText("Worked out from your lean mass and trend weight.")).toBeTruthy();
    });
  });

  describe("with nothing read", () => {
    it("should say where readings come from, with no figure, switch or action", async () => {
      renderView();

      expect(await screen.findByText(BODY_COMPOSITION.noReadingsWeb)).toBeTruthy();
      expect(screen.queryByRole("img")).toBeNull();
      expect(screen.queryByRole("radiogroup")).toBeNull();
      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.queryByRole("link")).toBeNull();
    });
  });

  describe("while the readings load", () => {
    it("should be one status named for the readings, and no figure", async () => {
      weightBackend.bodyReadsHang = true;
      renderView();

      const status = await screen.findByRole("status", { name: BODY_COMPOSITION.loadingLabel });

      expect(screen.getAllByRole("status")).toEqual([status]);
      expect(screen.queryByRole("img")).toBeNull();
    });
  });

  describe("when a read failed with nothing to show", () => {
    it("should be the error state with Try again, and Try again reads again", async () => {
      weightBackend.bodyReadsFail = true;
      renderView();

      const alert = await screen.findByRole("alert");

      expect(within(alert).getByText(BODY_COMPOSITION.error.title)).toBeTruthy();
      expect(screen.queryByRole("img")).toBeNull();

      weightBackend.bodyReadsFail = false;
      weightBackend.bodyMeasurements = steadyBodyFat();
      fireEvent.click(within(alert).getByRole("button", { name: BODY_COMPOSITION.error.retry }));

      expect(await figure()).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it.each(["body_fat_pct", "lean_mass_kg"])(
      "should be the error state with Try again when only %s failed and the other has no readings",
      async (failedKind) => {
        weightBackend.bodyKindsFail = [failedKind];
        renderView();

        const alert = await screen.findByRole("alert");

        expect(
          within(alert).getByRole("button", { name: BODY_COMPOSITION.error.retry }),
        ).toBeTruthy();
        expect(screen.queryByText(BODY_COMPOSITION.noReadingsWeb)).toBeNull();
        expect(screen.queryByRole("img")).toBeNull();
      },
    );

    it("should read only the failed kind again when Try again is pressed", async () => {
      weightBackend.bodyKindsFail = ["body_fat_pct"];
      renderView();
      const alert = await screen.findByRole("alert");
      await waitFor(() => {
        expect(weightBackend.bodyRequestCountByKind.lean_mass_kg).toBeGreaterThan(0);
      });
      const before = { ...weightBackend.bodyRequestCountByKind };

      fireEvent.click(within(alert).getByRole("button", { name: BODY_COMPOSITION.error.retry }));

      await waitFor(() => {
        expect(weightBackend.bodyRequestCountByKind.body_fat_pct).toBe(
          (before.body_fat_pct ?? 0) + 1,
        );
      });
      expect(weightBackend.bodyRequestCountByKind.lean_mass_kg).toBe(before.lean_mass_kg);
    });

    it("should leave the database's own message out of the page", async () => {
      weightBackend.bodyReadsFail = true;
      renderView();
      await screen.findByRole("alert");

      expect(document.body.textContent).not.toContain(LEAKY_DATABASE_MESSAGE);
    });

    it("should draw the split in place of the error when the other kind can work it out", async () => {
      weightBackend.bodyMeasurements = steadyBodyFat();
      weightBackend.bodyKindsFail = ["lean_mass_kg"];
      renderView();

      expect(await figure()).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("should draw the split from lean mass when body fat failed and lean mass has readings", async () => {
      weightBackend.bodyMeasurements = steadyLeanMass();
      weightBackend.bodyKindsFail = ["body_fat_pct"];
      renderView();

      expect(await figure()).toBeTruthy();
      expect(screen.getByText("Worked out from your lean mass and trend weight.")).toBeTruthy();
    });
  });

  describe("offline", () => {
    it("should be the error state with no Try again, and never a skeleton, with nothing read", async () => {
      onlineManager.setOnline(false);
      renderView();

      const alert = await screen.findByRole("alert");

      expect(within(alert).getByText(BODY_COMPOSITION.error.title)).toBeTruthy();
      expect(within(alert).queryByRole("button")).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("should keep the figure that was read this session when the connection goes", async () => {
      weightBackend.bodyMeasurements = [...steadyBodyFat(), ...steadyLeanMass()];
      renderView();
      await figure();

      act(() => {
        onlineManager.setOnline(false);
      });

      expect(await figure()).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("should draw the split from the kind that was read when the other is paused with nothing read", async () => {
      const queryClient = createWeightQueryClient();
      queryClient.setQueryData(keys.bodyMeasurements.list("body_fat_pct"), steadyBodyFat());
      onlineManager.setOnline(false);
      renderWithWeight(<Harness />, queryClient);

      expect(await figure()).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
    });
  });
});
