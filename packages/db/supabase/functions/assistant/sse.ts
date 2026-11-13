// Server-Sent Events for the `turn` route: one JSON event per `data:` line. Every event is checked
// against the contract before it is written, so the app never reads a shape it rejects.
import { assistantStreamEventSchema } from "../_shared/core.ts";
import { corsHeaders } from "../_shared/http.ts";
import { reportError } from "../_shared/report.ts";

import type { AssistantStreamEvent } from "../_shared/core.ts";
import type { ReportError } from "../_shared/report.ts";

export type EventStream = {
  // True once the stream has ended or the reader went away. Nothing is written after that.
  readonly closed: boolean;
  // Aborts when the reader goes away (a closed sheet, a backgrounded app or a lost connection, which the
  // server cannot tell apart). It stops nothing: the turn runs to its end and stores its reply. It only says
  // that nobody is reading, so a later change can decide on a push.
  readonly signal: AbortSignal;
  // True once a `done` event was written. A turn has exactly one, so nothing is written after it.
  readonly done: boolean;
  write(text: string): void;
  markDone(): void;
  close(): void;
};

export function createEventStream(): { stream: EventStream; body: ReadableStream<Uint8Array> } {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let closed = false;
  let done = false;
  const readerGone = new AbortController();
  const body = new ReadableStream<Uint8Array>({
    start(started) {
      controller = started;
    },
    // The reader went away. The turn goes on, and what it writes from here is dropped, so nothing is
    // enqueued on a closed controller.
    cancel() {
      closed = true;
      readerGone.abort();
    },
  });
  const stream: EventStream = {
    get closed() {
      return closed;
    },
    get done() {
      return done;
    },
    signal: readerGone.signal,
    write(text) {
      if (!closed) {
        controller.enqueue(encoder.encode(text));
      }
    },
    markDone() {
      done = true;
    },
    close() {
      if (!closed) {
        closed = true;
        controller.close();
      }
    },
  };
  return { stream, body };
}

export function eventResponse(body: ReadableStream<Uint8Array>): Response {
  return new Response(body, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}

function writeLine(stream: EventStream, event: AssistantStreamEvent): void {
  stream.write(`data: ${JSON.stringify(event)}\n\n`);
}

// Returns whether the event was written. Nothing is written once the stream has closed or a `done`
// has gone. An event that fails the contract is a bug in this function, so it is reported without its
// content, and the turn ends as a failed one.
export function writeEvent(
  stream: EventStream,
  event: AssistantStreamEvent,
  report: ReportError = reportError,
): boolean {
  // Checked first, so an event that breaks the contract is reported even when the reader is gone.
  if (!assistantStreamEventSchema.safeParse(event).success) {
    report("assistant", "internal_error", new Error("assistant wrote an invalid event"));
    endAsFailed(stream);
    return false;
  }
  if (stream.closed || stream.done) {
    return false;
  }
  writeLine(stream, event);
  if (event.type === "done") {
    stream.markDone();
  }
  return true;
}

// Ends a turn that has no `done` yet. After one, the turn has ended, so it writes nothing.
export function endAsFailed(stream: EventStream): void {
  if (stream.done) {
    return;
  }
  writeLine(stream, { type: "notice", notice: { code: "turn_failed" } });
  writeLine(stream, { type: "done", outcome: "failed" });
  stream.markDone();
  stream.close();
}
