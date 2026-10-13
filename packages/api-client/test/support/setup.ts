import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import { clearQueryClients } from "./queryClients";

// Vitest does not expose its hooks as globals, so Testing Library cannot register its own cleanup.
// Without this, every hook a test renders stays mounted and keeps taking state updates from its
// query client, up to and past the end of the file, when the jsdom window is already gone.
afterEach(() => {
  cleanup();
  clearQueryClients();
});
