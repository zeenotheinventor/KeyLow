import { createBodyFigureStore } from "./bodyFigureStore";

/** The one store the site reads. It sits in an object so the test helper can swap it for a fresh one. */
export const currentBodyFigureStore = { store: createBodyFigureStore() };
