import { assertEquals } from "@std/assert";

import { createEventStream, writeEvent } from "./sse.ts";

import type { ReportError } from "../_shared/report.ts";

const turnId = "00000000-0000-4000-8000-0000000000d3";
const conversationId = "00000000-0000-4000-8000-0000000000c1";

function reportSpy() {
  const reports: [functionName: string, code: string][] = [];
  const report: ReportError = (functionName, code) => {
    reports.push([functionName, code]);
  };
  return { reports, report };
}

// The data lines of what was written, parsed.
const events = (text: string) =>
  text
    .split("\n\n")
    .filter((block) => block !== "")
    .map((block) => JSON.parse(block.replace(/^data: /, "")));

Deno.test("writeEvent writes a valid event as one data line", async () => {
  const { stream, body } = createEventStream();
  const spy = reportSpy();

  const written = writeEvent(stream, { type: "turn", turnId, conversationId }, spy.report);
  stream.close();

  assertEquals(written, true);
  assertEquals(
    await new Response(body).text(),
    `data: ${JSON.stringify({ type: "turn", turnId, conversationId })}\n\n`,
  );
  assertEquals(spy.reports, []);
});

Deno.test(
  "an invalid event is reported, not written, and the stream ends with turn_failed",
  async () => {
    const { stream, body } = createEventStream();
    const spy = reportSpy();
    const invalid = JSON.parse('{"type":"done","outcome":"sideways"}');

    const written = writeEvent(stream, invalid, spy.report);
    const afterwards = writeEvent(stream, { type: "text", delta: "late" }, spy.report);

    assertEquals([written, afterwards], [false, false]);
    assertEquals(spy.reports, [["assistant", "internal_error"]]);
    assertEquals(events(await new Response(body).text()), [
      { type: "notice", notice: { code: "turn_failed" } },
      { type: "done", outcome: "failed" },
    ]);
  },
);

Deno.test("writing after the reader went away is ignored", async () => {
  const { stream, body } = createEventStream();

  await body.cancel();

  assertEquals(writeEvent(stream, { type: "text", delta: "hello" }, reportSpy().report), false);
  stream.close();
});
