import AsyncStorage from "@react-native-async-storage/async-storage";

import type { BodyArtworkFigure } from "@keylow/core/training";

export const bodyFigureStorageKey = "bodyMap.figure";
export const defaultBodyFigure: BodyArtworkFigure = "male";

export type StoredBodyFigure = {
  figure: BodyArtworkFigure;
  /** Whether the person has answered the question already, so it is not asked again. */
  hasChosen: boolean;
};

function isBodyFigure(value: string | null): value is BodyArtworkFigure {
  return value === "male" || value === "female";
}

/**
 * The figure last chosen on this device. Nothing valid saved is Male, not yet chosen, so the question is
 * asked. A store that cannot be read is Male and counts as chosen: a question that cannot be saved would
 * trap the person in it.
 */
export async function readBodyFigure(): Promise<StoredBodyFigure> {
  try {
    const stored = await AsyncStorage.getItem(bodyFigureStorageKey);
    return isBodyFigure(stored)
      ? { figure: stored, hasChosen: true }
      : { figure: defaultBodyFigure, hasChosen: false };
  } catch {
    return { figure: defaultBodyFigure, hasChosen: true };
  }
}

/** A figure that cannot be saved still applies for this visit, so the failure is not raised. */
export async function writeBodyFigure(figure: BodyArtworkFigure): Promise<void> {
  try {
    await AsyncStorage.setItem(bodyFigureStorageKey, figure);
  } catch {
    // Nothing to do: the next visit starts from the last figure that did save.
  }
}
