import { loadBodyModel } from "@keylow/body-3d";

import { readOnce } from "./readOnce";

import type { BodyModel } from "@keylow/body-3d";

// The bundler gives the file a hashed name and a long cache, and leaves it out of the JavaScript.
const MALE_MODEL_URL = new URL("@keylow/body-model/male.glb", import.meta.url);

async function readMaleModel(): Promise<BodyModel> {
  const response = await fetch(MALE_MODEL_URL);
  if (!response.ok) {
    throw new Error("The body model could not be fetched.");
  }
  return loadBodyModel(await response.arrayBuffer());
}

/** The male model, fetched and parsed once for the page however many canvases ask. A read that fails stays failed until the page is loaded again. */
export const maleBodyModel = readOnce(readMaleModel);
