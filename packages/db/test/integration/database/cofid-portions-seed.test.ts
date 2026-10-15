import { readFileSync } from "node:fs";

import { afterAll, describe, expect, it } from "vitest";

import { parsePortionRows } from "../../../scripts/portions/portionRows";
import { adminClient } from "../support/stack";
import { createTestUser, deleteCreatedTestUsers } from "../support/users";

// The picker starts on the default portion that search_foods returns. This reads the foods and portions
// the seed (supabase/seeds/30_cofid_portions.sql) left in the database, as a signed in user sees them,
// and compares them with the file the seed was made from. It looks up the real CoFID foods by name.
const portionRows = parsePortionRows(
  readFileSync(new URL("../../../data/portions/cofid-portions.csv", import.meta.url), "utf8"),
);

const loadSeedsMessage =
  "load seeds/30_cofid_portions.sql as docs/runbooks/local-dev.md says (psql with the seed file)";

afterAll(async () => {
  await deleteCreatedTestUsers();
});

describe.each([
  { foodCode: "14-318", searchText: "Bananas, flesh only" },
  { foodCode: "18-317", searchText: "Chicken, thighs, casseroled, meat and skin" },
])(
  "the default portion search_foods returns for CoFID food $foodCode",
  ({ foodCode, searchText }) => {
    it("should be the portion the file marks as the default", async () => {
      const fileDefault = portionRows.find((row) => row.foodCode === foodCode && row.isDefault);
      expect(fileDefault).toBeDefined();

      // search_foods returns a lean row without source_ref, so the food is found by its id.
      const { data: food } = await adminClient()
        .from("foods")
        .select("id")
        .eq("source", "cofid")
        .eq("source_ref", foodCode)
        .single();

      const user = await createTestUser("cofid-portions-seed");
      const { data, error } = await user.client.rpc("search_foods", { q: searchText, lim: 50 });
      expect(error).toBeNull();
      const hit = data?.find(({ id }) => id === food?.id);

      expect(hit?.default_portion_label, loadSeedsMessage).toBe(fileDefault?.label);
      expect(hit?.default_portion_grams, loadSeedsMessage).toBe(fileDefault?.grams);
      expect(hit?.default_portion_ml).toBeNull();
    });
  },
);
