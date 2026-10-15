import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

import { clearQueryClients } from "./queryClients";

// Testing Library gives waitFor and findBy* 1 s by default, and the test timeout does not change that.
// A passing test returns as soon as its assertion holds, so a longer limit only helps a loaded machine.
configure({ asyncUtilTimeout: 5000 });

// Vitest does not expose its hooks as globals, so Testing Library cannot register its own cleanup.
// Without this, every hook a test renders stays mounted and keeps taking state updates from its
// query client, up to and past the end of the file, when the jsdom window is already gone.
afterEach(() => {
  cleanup();
  clearQueryClients();
});
