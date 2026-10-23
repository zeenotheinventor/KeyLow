import { createBodyMapRendererStore } from "./bodyMapRendererStore";
import { currentBodyMapRendererStore } from "./currentBodyMapRendererStore";

/** Forgets what was read and chosen, so each test starts from a fresh install. For tests only. */
export function resetBodyMapRendererForTests(): void {
  currentBodyMapRendererStore.store = createBodyMapRendererStore();
}
