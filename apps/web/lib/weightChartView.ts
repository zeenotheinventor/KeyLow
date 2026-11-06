import { useSyncExternalStore } from "react";

import type { BodySplitUnit } from "@keylow/core/weight";

import { readLocalPreference, writeLocalPreference } from "@/lib/localPreference";

/** Which figure the trend card draws under its range control. */
export type WeightChartView = "weight" | "composition";

type WeightChartChoice = { view: WeightChartView; unit: BodySplitUnit };

// The keys the phone saves the same two choices under.
const VIEW_KEY = "weight.chartView";
const UNIT_KEY = "weight.compositionUnit";

const DEFAULT_CHOICE: WeightChartChoice = { view: "weight", unit: "kg" };

const isWeightChartView = (stored: string): stored is WeightChartView =>
  stored === "weight" || stored === "composition";
const isBodySplitUnit = (stored: string): stored is BodySplitUnit =>
  stored === "kg" || stored === "pct";

function createWeightChartViewStore() {
  let choice: WeightChartChoice | null = null;
  const listeners = new Set<() => void>();

  function change(next: Partial<WeightChartChoice>) {
    choice = { ...(choice ?? readChoice()), ...next };
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    // This reads storage during render, which is safe only because the server snapshot is the default and
    // the first draw in the browser is made from it, so the server and the browser agree. A reuse must keep that.
    getSnapshot: (): WeightChartChoice => (choice ??= readChoice()),
    getServerSnapshot: (): WeightChartChoice => DEFAULT_CHOICE,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setView: (view: WeightChartView) => {
      change({ view });
      writeLocalPreference(VIEW_KEY, view);
    },
    setUnit: (unit: BodySplitUnit) => {
      change({ unit });
      writeLocalPreference(UNIT_KEY, unit);
    },
  };
}

/** What this browser saved: nothing valid saved, or storage that cannot be read, is Weight in kg. */
function readChoice(): WeightChartChoice {
  return {
    view: readLocalPreference(VIEW_KEY, isWeightChartView) ?? DEFAULT_CHOICE.view,
    unit: readLocalPreference(UNIT_KEY, isBodySplitUnit) ?? DEFAULT_CHOICE.unit,
  };
}

/** The one store the site reads. It sits in an object so the test helper can swap it for a fresh one. */
const current = { store: createWeightChartViewStore() };

/** Forgets what was read and chosen, so each test starts from a fresh browser. For tests only. */
export function resetWeightChartViewForTests(): void {
  current.store = createWeightChartViewStore();
}

const subscribe = (listener: () => void) => current.store.subscribe(listener);
const getSnapshot = () => current.store.getSnapshot();
const getServerSnapshot = () => current.store.getServerSnapshot();
const setView = (view: WeightChartView) => {
  current.store.setView(view);
};
const setUnit = (unit: BodySplitUnit) => {
  current.store.setUnit(unit);
};

/**
 * The view the weight trend card shows, Weight or Composition, and the unit the composition lines use, kg or
 * per cent, remembered in this browser and shared by every reader. The server has no storage, so its first
 * draw, and the browser's first draw that hydrates it, is Weight in kg, and the saved choice follows at once.
 * Nothing saved, a value that is not a choice or storage that cannot be read is Weight in kg.
 */
export function useWeightChartView(): WeightChartChoice & {
  setView: (view: WeightChartView) => void;
  setUnit: (unit: BodySplitUnit) => void;
} {
  const choice = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return { ...choice, setView, setUnit };
}
