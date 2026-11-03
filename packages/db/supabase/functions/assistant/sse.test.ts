import { assertEquals } from "@std/assert";

import { createEventStream, endAsFailed, writeEvent } from "./sse.ts";

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

Deno.test("after a done, nothing more is written and endAsFailed adds no second done", async () => {
  const { stream, body } = createEventStream();
  const spy = reportSpy();

  const first = writeEvent(stream, { type: "done", outcome: "complete" }, spy.report);
  const text = writeEvent(stream, { type: "text", delta: "late" }, spy.report);
  const done = writeEvent(stream, { type: "done", outcome: "failed" }, spy.report);
  endAsFailed(stream);
  stream.close();

  assertEquals([first, text, done], [true, false, false]);
  assertEquals(events(await new Response(body).text()), [{ type: "done", outcome: "complete" }]);
  assertEquals(spy.reports, []);
});

Deno.test("endAsFailed writes its own done once, and a second call writes nothing", async () => {
  const { stream, body } = createEventStream();

  endAsFailed(stream);
  endAsFailed(stream);

  assertEquals(events(await new Response(body).text()), [
    { type: "notice", notice: { code: "turn_failed" } },
    { type: "done", outcome: "failed" },
  ]);
});
