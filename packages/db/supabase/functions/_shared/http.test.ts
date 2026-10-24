import { assertEquals } from "@std/assert";

import { error, handle } from "./http.ts";

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

Deno.test(
  "error answers the three run-checkin codes with the status the contract names",
  async () => {
    const bodies = [
      { response: error("bad_mode", "m"), status: 400, code: "bad_mode" },
      { response: error("no_program", "m"), status: 409, code: "no_program" },
      { response: error("missing_stats", "m"), status: 409, code: "missing_stats" },
    ];

    for (const { response, status, code } of bodies) {
      assertEquals(response.status, status);
      assertEquals(await response.json(), { error: { code, message: "m" } });
    }
  },
);

Deno.test("error answers the status of each code run-checkin sends", async () => {
  const bodies = await Promise.all(
    (["bad_mode", "no_program", "missing_stats"] as const).map((code) =>
      error(code, "message")
        .json()
        .then((body) => body.error.code),
    ),
  );
  const statuses = (["bad_mode", "no_program", "missing_stats"] as const).map(
    (code) => error(code, "message").status,
  );

  assertEquals(bodies, ["bad_mode", "no_program", "missing_stats"]);
  assertEquals(statuses, [400, 409, 409]);
});
