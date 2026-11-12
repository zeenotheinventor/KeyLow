import { BODY_MAP_RENDERERS } from "@keylow/core/training";

import type { BodyMapRenderer } from "@keylow/core/training";

import { readLocalPreference, writeLocalPreference } from "@/lib/localPreference";

/** The key the phone saves the same choice under. */
export const BODY_MAP_RENDERER_KEY = "bodyMap.renderer";
export const DEFAULT_BODY_MAP_RENDERER: BodyMapRenderer = "2d";

const isBodyMapRenderer = (stored: string): stored is BodyMapRenderer =>
  BODY_MAP_RENDERERS.some((renderer) => renderer === stored);

/**
 * The renderer last chosen in this browser. Nothing valid saved, a value that is not a renderer, or storage
 * that cannot be read is 2D. Call it from an effect, an event handler or a store read behind a null server
 * snapshot, not from a render that the server also runs.
 */
export function readBodyMapRenderer(): BodyMapRenderer {
  return readLocalPreference(BODY_MAP_RENDERER_KEY, isBodyMapRenderer) ?? DEFAULT_BODY_MAP_RENDERER;
}

/** A renderer that cannot be saved still applies for the visit, so the failure is not raised. */
export function writeBodyMapRenderer(renderer: BodyMapRenderer): void {
  writeLocalPreference(BODY_MAP_RENDERER_KEY, renderer);
}
