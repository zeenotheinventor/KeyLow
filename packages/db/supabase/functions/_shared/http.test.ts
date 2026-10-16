import { assertEquals } from "@std/assert";

import { handle } from "./http.ts";

type Report = [functionName: string, code: string, caught: unknown];

function reportSpy() {
  const reports: Report[] = [];
  return {
    reports,
    report: (functionName: string, code: string, caught: unknown) => {
      reports.push([functionName, code, caught]);
    },
  };
}

Deno.test("handle reports an uncaught throw once and answers a typed 500", async () => {
  const spy = reportSpy();
  const thrown = new Error("boom");
  const handler = handle(
    "off-product",
    () => {
      throw thrown;
    },
    spy.report,
  );

  const response = await handler(new Request("http://localhost/off-product", { method: "POST" }));

  assertEquals(response.status, 500);
  assertEquals((await response.json()).error.code, "internal_error");
  assertEquals(spy.reports, [["off-product", "internal_error", thrown]]);
});

Deno.test("handle reports nothing for an answered request or a preflight", async () => {
  const spy = reportSpy();
  const handler = handle("off-product", () => Response.json({ ok: true }), spy.report);

  await handler(new Request("http://localhost/off-product", { method: "POST" }));
  await handler(new Request("http://localhost/off-product", { method: "OPTIONS" }));

  assertEquals(spy.reports, []);
});
