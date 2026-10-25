import { useCallback, useEffect, useRef, useState } from "react";

import {
  defaultCompositionUnit,
  defaultWeightChartView,
  readCompositionUnit,
  readWeightChartView,
  writeCompositionUnit,
  writeWeightChartView,
} from "./weightChartViewStore";

import type { CompositionUnit, WeightChartView } from "./weightChartViewStore";

// How long the card waits for the stored choices before it shows the defaults: the phone answers at once,
// so a store that has not is stuck, and the card must not wait on it for good.
const READ_TIMEOUT_MILLISECONDS = 1000;

/**
 * The view the weight trend card shows, Weight or Composition, and the unit its composition lines use,
 * kg or %, remembered per device. They are Weight and kg until the store has been read, so a card that
 * must not draw the wrong view waits for `isRead`. A store that cannot be read leaves the defaults, and so
 * does one that has not answered in a second, whose late answer is ignored. A choice made before the read
 * has finished is kept over what the read finds for that choice.
 */
export function useWeightChartView(): {
  view: WeightChartView;
  unit: CompositionUnit;
  isRead: boolean;
  setView: (view: WeightChartView) => void;
  setUnit: (unit: CompositionUnit) => void;
} {
  const [view, setViewState] = useState<WeightChartView>(defaultWeightChartView);
  const [unit, setUnitState] = useState<CompositionUnit>(defaultCompositionUnit);
  const [isRead, setIsRead] = useState(false);
  const hasChosenView = useRef(false);
  const hasChosenUnit = useRef(false);

  useEffect(() => {
    let isSettled = false;
    const settle = (storedView: WeightChartView, storedUnit: CompositionUnit) => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      clearTimeout(timer);
      if (!hasChosenView.current) {
        setViewState(storedView);
      }
      if (!hasChosenUnit.current) {
        setUnitState(storedUnit);
      }
      setIsRead(true);
    };
    const timer = setTimeout(() => {
      settle(defaultWeightChartView, defaultCompositionUnit);
    }, READ_TIMEOUT_MILLISECONDS);
    void Promise.all([readWeightChartView(), readCompositionUnit()]).then(
      ([storedView, storedUnit]) => {
        settle(storedView, storedUnit);
      },
    );

    return () => {
      isSettled = true;
      clearTimeout(timer);
    };
  }, []);

  const setView = useCallback((next: WeightChartView) => {
    hasChosenView.current = true;
    setViewState(next);
    void writeWeightChartView(next);
  }, []);

  const setUnit = useCallback((next: CompositionUnit) => {
    hasChosenUnit.current = true;
    setUnitState(next);
    void writeCompositionUnit(next);
  }, []);

  return { view, unit, isRead, setView, setUnit };
}
