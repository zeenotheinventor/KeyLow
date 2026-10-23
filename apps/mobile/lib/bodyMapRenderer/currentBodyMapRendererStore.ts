import { createBodyMapRendererStore } from "./bodyMapRendererStore";

/** The one store the app reads. It sits in an object so the test helper can swap it for a fresh one. */
export const currentBodyMapRendererStore = { store: createBodyMapRendererStore() };
