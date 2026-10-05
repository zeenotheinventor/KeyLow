import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/database.types";

// createClient makes no network call until a query runs, so this URL is never contacted.
// Each client gets its own storage key because the auth client warns when two share one.
export const createTestClient = () =>
  createClient<Database>("http://127.0.0.1:54321", "test-anon-key", {
    auth: { storageKey: `test-${crypto.randomUUID()}` },
  });
