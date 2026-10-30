import { createBodyFigureStore } from "./bodyFigureStore";
import { currentBodyFigureStore } from "./currentBodyFigureStore";

/** Forgets what was read and chosen, so each test starts from a fresh browser. For tests only. */
export function resetBodyFigureForTests(): void {
  currentBodyFigureStore.store = createBodyFigureStore();
}
