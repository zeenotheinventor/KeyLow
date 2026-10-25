import AsyncStorage from "@react-native-async-storage/async-storage";

export type WeightChartView = "weight" | "composition";
// Written to match core's BodySplitUnit, which this module does not import.
export type CompositionUnit = "kg" | "pct";

export const weightChartViewStorageKey = "weight.chartView";
export const compositionUnitStorageKey = "weight.compositionUnit";
export const defaultWeightChartView: WeightChartView = "weight";
export const defaultCompositionUnit: CompositionUnit = "kg";

function isWeightChartView(value: string | null): value is WeightChartView {
  return value === "weight" || value === "composition";
}

function isCompositionUnit(value: string | null): value is CompositionUnit {
  return value === "kg" || value === "pct";
}

/** The view last chosen on this device, or Weight when nothing valid is saved or storage cannot be read. */
export async function readWeightChartView(): Promise<WeightChartView> {
  try {
    const stored = await AsyncStorage.getItem(weightChartViewStorageKey);
    return isWeightChartView(stored) ? stored : defaultWeightChartView;
  } catch {
    return defaultWeightChartView;
  }
}

/** The unit last chosen on this device, or kg when nothing valid is saved or storage cannot be read. */
export async function readCompositionUnit(): Promise<CompositionUnit> {
  try {
    const stored = await AsyncStorage.getItem(compositionUnitStorageKey);
    return isCompositionUnit(stored) ? stored : defaultCompositionUnit;
  } catch {
    return defaultCompositionUnit;
  }
}

/** A view that cannot be saved still applies for this visit, so the failure is not raised. */
export async function writeWeightChartView(view: WeightChartView): Promise<void> {
  try {
    await AsyncStorage.setItem(weightChartViewStorageKey, view);
  } catch {
    // Nothing to do: the next visit starts from the last view that did save.
  }
}

/** A unit that cannot be saved still applies for this visit, so the failure is not raised. */
export async function writeCompositionUnit(unit: CompositionUnit): Promise<void> {
  try {
    await AsyncStorage.setItem(compositionUnitStorageKey, unit);
  } catch {
    // Nothing to do: the next visit starts from the last unit that did save.
  }
}
