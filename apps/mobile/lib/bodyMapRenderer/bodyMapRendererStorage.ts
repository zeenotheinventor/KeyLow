import { BODY_MAP_RENDERERS } from "@keylow/core/training";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { BodyMapRenderer } from "@keylow/core/training";

export const bodyMapRendererStorageKey = "bodyMap.renderer";
export const defaultBodyMapRenderer: BodyMapRenderer = "2d";

function toBodyMapRenderer(value: string | null): BodyMapRenderer | undefined {
  return BODY_MAP_RENDERERS.find((renderer) => renderer === value);
}

/** The renderer last chosen on this device. Nothing valid saved, or a store that cannot be read, is 2D. */
export async function readBodyMapRenderer(): Promise<BodyMapRenderer> {
  try {
    const stored = await AsyncStorage.getItem(bodyMapRendererStorageKey);
    return toBodyMapRenderer(stored) ?? defaultBodyMapRenderer;
  } catch {
    return defaultBodyMapRenderer;
  }
}

/** A renderer that cannot be saved still applies for this visit, so the failure is not raised. */
export async function writeBodyMapRenderer(renderer: BodyMapRenderer): Promise<void> {
  try {
    await AsyncStorage.setItem(bodyMapRendererStorageKey, renderer);
  } catch {
    // Nothing to do: the next visit starts from the last renderer that did save.
  }
}
