import type { BodyArtworkFigure } from "@keylow/core/training";

import { readLocalPreferenceState, writeLocalPreference } from "@/lib/localPreference";

export const BODY_FIGURE_KEY = "bodyMap.figure";
export const DEFAULT_BODY_FIGURE: BodyArtworkFigure = "male";

export type StoredBodyFigure = {
  figure: BodyArtworkFigure;
  /** Whether the person has answered the question already, so it is not asked again. */
  hasChosen: boolean;
};

const isBodyFigure = (stored: string): stored is BodyArtworkFigure =>
  stored === "male" || stored === "female";

/**
 * The figure last chosen in this browser. Nothing valid stored is Male, not yet chosen, so the question is
 * asked. Storage that cannot be read is Male and counts as chosen: a question that cannot be saved would
 * ask again at every visit. Call it from an effect, an event handler or a store read behind a null server
 * snapshot, not from a render that the server also runs.
 */
export function readBodyFigure(): StoredBodyFigure {
  const state = readLocalPreferenceState(BODY_FIGURE_KEY, isBodyFigure);
  switch (state.status) {
    case "saved":
      return { figure: state.value, hasChosen: true };
    case "empty":
      return { figure: DEFAULT_BODY_FIGURE, hasChosen: false };
    case "unreadable":
      return { figure: DEFAULT_BODY_FIGURE, hasChosen: true };
  }
}

/** A figure that cannot be saved still applies for the visit, so the failure is not raised. */
export function writeBodyFigure(figure: BodyArtworkFigure): void {
  writeLocalPreference(BODY_FIGURE_KEY, figure);
}
