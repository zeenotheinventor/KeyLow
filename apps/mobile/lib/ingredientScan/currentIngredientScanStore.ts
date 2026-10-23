import { createIngredientScanStore } from "./ingredientScanStore";

/** The one store the app uses. It sits in an object so the test helper can swap it for a fresh one. */
export const currentIngredientScanStore = { store: createIngredientScanStore() };
