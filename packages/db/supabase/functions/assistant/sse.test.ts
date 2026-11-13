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

Deno.test(
  "the stream's signal aborts when the reader goes away, and not when the turn closes it",
  async () => {
    const gone = createEventStream();
    const finished = createEventStream();

    await gone.body.cancel();
    finished.stream.close();

    assertEquals(gone.stream.closed, true);
    assertEquals(gone.stream.signal.aborted, true);
    assertEquals(finished.stream.signal.aborted, false);
  },
);

Deno.test("a contract-breaking event is reported even when the reader is gone", async () => {
  const { stream, body } = createEventStream();
  const spy = reportSpy();

  await body.cancel();
  const written = writeEvent(
    stream,
    JSON.parse('{"type":"done","outcome":"sideways"}'),
    spy.report,
  );

  assertEquals(written, false);
  assertEquals(spy.reports, [["assistant", "internal_error"]]);
});

Deno.test(
  "after the reader went away every write path is a no-op and none throws on the closed controller",
  async () => {
    const { stream, body } = createEventStream();
    const spy = reportSpy();

    await body.cancel();
    stream.write("data: late\n\n");
    writeEvent(stream, { type: "done", outcome: "complete" }, spy.report);
    endAsFailed(stream);
    stream.close();

    assertEquals(stream.signal.aborted, true);
    assertEquals(stream.closed, true);
    assertEquals(spy.reports, []);
  },
);
