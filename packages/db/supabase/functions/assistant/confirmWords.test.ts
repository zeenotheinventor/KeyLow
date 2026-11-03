import { assertEquals } from "@std/assert";

import { confirmDeleteButtons } from "../_shared/core.ts";
import { confirmWordsFor } from "./confirmWords.ts";

const ids = [
  "00000000-0000-4000-8000-0000000000e1",
  "00000000-0000-4000-8000-0000000000e2",
  "00000000-0000-4000-8000-0000000000e3",
];

Deno.test(
  "delete_entry gets core's delete buttons for the number of ids, and the danger tone",
  () => {
    assertEquals(confirmWordsFor("delete_entry", { ids }), {
      ...confirmDeleteButtons(3),
      tone: "danger",
    });
    assertEquals(confirmWordsFor("delete_entry", { ids: ids.slice(0, 2) }), {
      ...confirmDeleteButtons(2),
      tone: "danger",
    });
  },
);

Deno.test("a confirming tool with no line gives no words", () => {
  assertEquals(confirmWordsFor("archive_recipe", { id: ids[0] }), null);
  assertEquals(confirmWordsFor("toString", {}), null);
});

Deno.test("a delete_entry input with no ids gives no words", () => {
  assertEquals(confirmWordsFor("delete_entry", {}), null);
  assertEquals(confirmWordsFor("delete_entry", { ids: [] }), null);
  assertEquals(confirmWordsFor("delete_entry", "not an object"), null);
});
