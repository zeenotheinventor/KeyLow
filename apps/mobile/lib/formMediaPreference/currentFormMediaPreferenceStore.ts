import { createFormMediaPreferenceStore } from "./formMediaPreferenceStore";

/** The one store the app reads. It sits in an object so the test helper can swap it for a fresh one. */
export const currentFormMediaPreferenceStore = { store: createFormMediaPreferenceStore() };
