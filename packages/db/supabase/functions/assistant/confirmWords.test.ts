import { assertEquals } from "@std/assert";

import {
  confirmArchiveButtons,
  confirmCopyButtons,
  confirmDeleteButtons,
} from "../_shared/core.ts";
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
  assertEquals(confirmWordsFor("update_targets", { kcal: 2000 }), null);
  assertEquals(confirmWordsFor("toString", {}), null);
});

Deno.test("a delete_entry input with no ids gives no words", () => {
  assertEquals(confirmWordsFor("delete_entry", {}), null);
  assertEquals(confirmWordsFor("delete_entry", { ids: [] }), null);
  assertEquals(confirmWordsFor("delete_entry", "not an object"), null);
});

Deno.test(
  "copy_day gets the board's copy buttons for the number of entries, and the primary tone",
  () => {
    const input = { from: "2026-11-02", to: "2026-11-03", entry_count: 8 };

    assertEquals(confirmWordsFor("copy_day", input), {
      confirmLabel: "Copy 8 entries",
      cancelLabel: "Don't copy",
      tone: "primary",
    });
    assertEquals(confirmWordsFor("copy_day", { ...input, entry_count: 1 }), {
      ...confirmCopyButtons(1),
      tone: "primary",
    });
  },
);

Deno.test("a copy_day input with no entry count gives no words", () => {
  assertEquals(confirmWordsFor("copy_day", { from: "2026-11-02", to: "2026-11-03" }), null);
  assertEquals(confirmWordsFor("copy_day", { entry_count: 0 }), null);
  assertEquals(confirmWordsFor("copy_day", null), null);
});

Deno.test("archive_recipe gets the board's archive buttons and the primary tone", () => {
  assertEquals(confirmWordsFor("archive_recipe", { id: ids[0] }), {
    confirmLabel: "Archive recipe",
    cancelLabel: "Keep it",
    tone: "primary",
  });
  assertEquals(confirmWordsFor("archive_recipe", { id: ids[0] }), {
    ...confirmArchiveButtons(),
    tone: "primary",
  });
});

Deno.test("an archive_recipe input with no id gives no words", () => {
  assertEquals(confirmWordsFor("archive_recipe", {}), null);
  assertEquals(confirmWordsFor("archive_recipe", { id: 3 }), null);
  assertEquals(confirmWordsFor("archive_recipe", null), null);
});

Deno.test(
  "edit_routine gets the board's remove buttons for the removals of the call, and the danger tone",
  () => {
    const remove = { op: "remove" };

    assertEquals(confirmWordsFor("edit_routine", { changes: [remove, remove, { op: "add" }] }), {
      confirmLabel: "Remove 2",
      cancelLabel: "Keep them",
      tone: "danger",
    });
    assertEquals(confirmWordsFor("edit_routine", { changes: [remove, remove, remove] }), {
      confirmLabel: "Remove 3",
      cancelLabel: "Keep them",
      tone: "danger",
    });
  },
);

Deno.test(
  "an edit_routine call with fewer than two removals, or none readable, gives no words",
  () => {
    assertEquals(
      confirmWordsFor("edit_routine", { changes: [{ op: "remove" }, { op: "add" }] }),
      null,
    );
    assertEquals(confirmWordsFor("edit_routine", { changes: [] }), null);
    assertEquals(confirmWordsFor("edit_routine", {}), null);
    assertEquals(confirmWordsFor("edit_routine", null), null);
  },
);
