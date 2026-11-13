// The assistant function's own list of words that make a kitchen turn (`isKitchenRequest`), loaded from the function's
// source so a case message is checked against the real list and never a copy. The module is imported by a computed
// address, because the function's folder has its own dependencies that this package does not carry, and its one import
// is a type.
import { fileURLToPath } from "node:url";

import { isRecord } from "../cases/kitchenGraders.ts";

const KITCHEN_SOURCE = fileURLToPath(
  new URL("../../../packages/db/supabase/functions/assistant/kitchen.ts", import.meta.url),
);

/** True when the words make a kitchen turn, so the kitchen tools are shown to the model on that turn. */
export async function isKitchenTurn(text: string): Promise<boolean> {
  const loaded: unknown = await import(/* @vite-ignore */ KITCHEN_SOURCE);
  if (!isRecord(loaded) || typeof loaded["isKitchenRequest"] !== "function") {
    throw new Error("The assistant function no longer exports isKitchenRequest");
  }
  return Reflect.apply(loaded["isKitchenRequest"], undefined, [text, undefined]) === true;
}
