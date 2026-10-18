import AsyncStorage from "@react-native-async-storage/async-storage";

import type { BodyMapView } from "@keylow/core/training";

export const bodyMapViewStorageKey = "bodyMap.view";
export const defaultBodyMapView: BodyMapView = "actual";

function isBodyMapView(value: string | null): value is BodyMapView {
  return value === "actual" || value === "projected";
}

/** The view last chosen on this device, or Actual when nothing valid is saved or storage cannot be read. */
export async function readBodyMapView(): Promise<BodyMapView> {
  try {
    const stored = await AsyncStorage.getItem(bodyMapViewStorageKey);
    return isBodyMapView(stored) ? stored : defaultBodyMapView;
  } catch {
    return defaultBodyMapView;
  }
}

/** A view that cannot be saved still applies for this visit, so the failure is not raised. */
export async function writeBodyMapView(view: BodyMapView): Promise<void> {
  try {
    await AsyncStorage.setItem(bodyMapViewStorageKey, view);
  } catch {
    // Nothing to do: the next visit starts from the last view that did save.
  }
}
