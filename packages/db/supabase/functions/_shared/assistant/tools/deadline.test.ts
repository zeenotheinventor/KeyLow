import { assert, assertEquals, assertRejects } from "@std/assert";

import { BudgetExceeded, deadlineOf } from "./deadline.ts";

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

Deno.test("a step that ends inside the deadline gives its own value", async () => {
  const { within } = deadlineOf(1_000);

  assertEquals(await within(Promise.resolve("done")), "done");
});

Deno.test("a step that runs past the deadline is BudgetExceeded", async () => {
  const { within } = deadlineOf(30);

  await assertRejects(() => within(wait(300)), BudgetExceeded);
});

Deno.test("a step that fails inside the deadline keeps its own error", async () => {
  const { within } = deadlineOf(1_000);

  await assertRejects(() => within(Promise.reject(new Error("own"))), Error, "own");
});

Deno.test("the time left counts down from the start", async () => {
  const { millisecondsLeft } = deadlineOf(1_000);
  const first = millisecondsLeft();
  await wait(20);

  assert(first <= 1_000);
  assert(millisecondsLeft() < first);
});
