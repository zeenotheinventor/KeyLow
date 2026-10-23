import { currentIngredientScanStore } from "./currentIngredientScanStore";
import { createIngredientScanStore } from "./ingredientScanStore";

/** Forgets any pending request and listener, so each test starts from a fresh app. For tests only. */
export function resetIngredientScanForTests(): void {
  currentIngredientScanStore.store = createIngredientScanStore();
}
