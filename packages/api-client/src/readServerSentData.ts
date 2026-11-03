const LINE_FEED = "\n";
const DATA_FIELD = "data:";

// The data of one event: its `data:` lines joined with a line feed. Comments, other fields and an
// event with no `data:` line carry none, so they answer null.
function dataOfEvent(event: string): string | null {
  const dataLines = event
    .split(LINE_FEED)
    .filter((line) => line.startsWith(DATA_FIELD))
    .map((line) => line.slice(DATA_FIELD.length))
    // One space after the colon is part of the syntax, any more belong to the data.
    .map((value) => (value.startsWith(" ") ? value.slice(1) : value));

  return dataLines.length === 0 ? null : dataLines.join(LINE_FEED);
}

/**
 * Reads a Server-Sent Events body and hands `onData` the data of each complete event, as it arrives. An
 * event ends at a blank line, so a chunk that stops in the middle of one waits for the rest, and an event
 * the stream ended in the middle of is dropped. `onData` answers whether to go on: false stops reading.
 * The stream is cancelled however reading ends. A failed read (an aborted request, a dropped connection)
 * or a throw in `onData` rejects.
 */
export async function readServerSentData(
  body: ReadableStream<Uint8Array>,
  onData: (data: string) => boolean,
): Promise<void> {
  const reader = body.getReader();
  // `stream: true` keeps a character that is split between two chunks until its other half arrives.
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }

      // The whole buffer is normalised, because a chunk can end between a carriage return and its line feed.
      buffer = (buffer + decoder.decode(value, { stream: true })).replaceAll("\r\n", LINE_FEED);

      for (let end = buffer.indexOf("\n\n"); end !== -1; end = buffer.indexOf("\n\n")) {
        const data = dataOfEvent(buffer.slice(0, end));
        buffer = buffer.slice(end + 2);

        if (data !== null && !onData(data)) {
          return;
        }
      }
    }
  } finally {
    // However reading ended (the end, a stop, a failed read or a throw in `onData`), the stream is released.
    await reader.cancel().catch(() => undefined);
  }
}
