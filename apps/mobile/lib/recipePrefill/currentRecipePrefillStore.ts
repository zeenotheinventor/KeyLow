import { createRecipePrefillStore } from "./recipePrefillStore";
import { createNonce } from "../widgets/createNonce";

/** The one store the app uses. It sits in an object so the test helper can swap it for a fresh one. */
export const currentRecipePrefillStore = { store: createRecipePrefillStore(createNonce) };
