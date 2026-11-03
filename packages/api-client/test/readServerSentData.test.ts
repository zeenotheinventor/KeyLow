import { describe, expect, it } from "vitest";

import { readServerSentData } from "../src/readServerSentData";

const encoder = new TextEncoder();

function streamOf(...chunks: (string | Uint8Array)[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
      }
      controller.close();
    },
  });
}

async function dataOf(body: ReadableStream<Uint8Array>) {
  const received: string[] = [];
  await readServerSentData(body, (data) => {
    received.push(data);
    return true;
  });
  return received;
}

describe("readServerSentData", () => {
  it("should hand over the data of each event in order", async () => {
    const body = streamOf('data: {"a":1}\n\ndata: {"a":2}\n\n');

    expect(await dataOf(body)).toEqual(['{"a":1}', '{"a":2}']);
  });

  it("should join an event that arrives in several chunks", async () => {
    const body = streamOf('data: {"a"', ":1}\n", "\ndata: 2\n\n");

    expect(await dataOf(body)).toEqual(['{"a":1}', "2"]);
  });

  it("should keep a character that is split between two chunks", async () => {
    const bytes = encoder.encode("data: crème\n\n");
    const splitInsideTheAccent = bytes.indexOf(0xc3) + 1;

    const body = streamOf(bytes.slice(0, splitInsideTheAccent), bytes.slice(splitInsideTheAccent));

    expect(await dataOf(body)).toEqual(["crème"]);
  });

  it("should read events that end with a carriage return and a line feed", async () => {
    const body = streamOf("data: one\r\n\r\ndata: two\r", "\n\r\n");

    expect(await dataOf(body)).toEqual(["one", "two"]);
  });

  it("should join the data lines of one event with a line feed", async () => {
    const body = streamOf("data: first\ndata: second\n\n");

    expect(await dataOf(body)).toEqual(["first\nsecond"]);
  });

  it("should drop only one space after the colon", async () => {
    const body = streamOf("data:no space\n\ndata:  two spaces\n\n");

    expect(await dataOf(body)).toEqual(["no space", " two spaces"]);
  });

  it("should ignore comments, other fields and events with no data", async () => {
    const body = streamOf(": keep-alive\n\nevent: ping\nid: 4\n\nevent: x\ndata: kept\n\n");

    expect(await dataOf(body)).toEqual(["kept"]);
  });

  it("should drop an event the stream ended in the middle of", async () => {
    const body = streamOf('data: {"a":1}\n\ndata: {"a":');

    expect(await dataOf(body)).toEqual(['{"a":1}']);
  });

  it("should stop reading and cancel the stream when the reader of events says stop", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("data: one\n\ndata: two\n\n"));
      },
      cancel() {
        cancelled = true;
      },
    });
    const received: string[] = [];

    await readServerSentData(body, (data) => {
      received.push(data);
      return false;
    });

    expect(received).toEqual(["one"]);
    expect(cancelled).toBe(true);
  });

  it("should cancel the stream and rethrow when the reader of events throws", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("data: one\n\n"));
      },
      cancel() {
        cancelled = true;
      },
    });

    await expect(
      readServerSentData(body, () => {
        throw new Error("could not use the event");
      }),
    ).rejects.toThrow("could not use the event");

    expect(cancelled).toBe(true);
  });
});
