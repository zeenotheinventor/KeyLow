import { afterEach, describe, expect, it, vi } from "vitest";

import { retryOnStaleConnection } from "../support/retryOnStaleConnection";

const kongMessage = "An invalid response was received from the upstream server";

const kongPlainTextBadGateway = () => new Response(kongMessage, { status: 502 });
const kongJsonBadGateway = () =>
  new Response(JSON.stringify({ message: kongMessage }), {
    status: 502,
    headers: { "Content-Type": "application/json" },
  });
const okResponse = () => new Response(JSON.stringify([{ id: 1 }]), { status: 200 });

/** What undici throws when the socket it was reusing is gone: a TypeError whose cause carries the code. */
const fetchFailedBecause = (cause: Error) => new TypeError("fetch failed", { cause });
const connectionReset = () =>
  fetchFailedBecause(Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }));
const otherSideClosed = () =>
  fetchFailedBecause(
    Object.assign(new Error("other side closed"), { name: "SocketError", code: "UND_ERR_SOCKET" }),
  );
const socketHangUp = () =>
  fetchFailedBecause(Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }));

const url = "http://127.0.0.1:54321/rest/v1/foods";
const init = { method: "POST", body: JSON.stringify({ name: "Oats" }) };

const wrapped = (...scripted: Array<Response | Error>) => {
  const baseFetch = vi.fn<typeof fetch>();
  for (const next of scripted) {
    if (next instanceof Error) {
      baseFetch.mockRejectedValueOnce(next);
    } else {
      baseFetch.mockResolvedValueOnce(next);
    }
  }
  return { baseFetch, retrying: retryOnStaleConnection(baseFetch, 0) };
};

afterEach(() => {
  vi.useRealTimers();
});

describe("retryOnStaleConnection", () => {
  describe("when the gateway answers with its own bad gateway", () => {
    it("should retry once on the plain text 502 and return the second response", async () => {
      const { baseFetch, retrying } = wrapped(kongPlainTextBadGateway(), okResponse());

      const response = await retrying(url, init);

      expect(response.status).toBe(200);
      expect(baseFetch).toHaveBeenCalledTimes(2);
    });

    it("should retry once on the JSON message form of the same 502", async () => {
      const { baseFetch, retrying } = wrapped(kongJsonBadGateway(), okResponse());

      const response = await retrying(url, init);

      expect(response.status).toBe(200);
      expect(baseFetch).toHaveBeenCalledTimes(2);
    });

    it("should send the same request again", async () => {
      const { baseFetch, retrying } = wrapped(kongPlainTextBadGateway(), okResponse());

      await retrying(url, init);

      expect(baseFetch).toHaveBeenNthCalledWith(1, url, init);
      expect(baseFetch).toHaveBeenNthCalledWith(2, url, init);
    });

    it("should wait about 200 milliseconds before the retry", async () => {
      vi.useFakeTimers();
      const baseFetch = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(kongPlainTextBadGateway())
        .mockResolvedValueOnce(okResponse());
      const retrying = retryOnStaleConnection(baseFetch);

      const pending = retrying(url, init);
      await vi.advanceTimersByTimeAsync(199);
      expect(baseFetch).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      expect((await pending).status).toBe(200);
      expect(baseFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("when the connection is reset", () => {
    it.each([
      ["ECONNRESET", connectionReset],
      ["other side closed", otherSideClosed],
      ["socket hang up", socketHangUp],
    ])("should retry once on %s", async (_label, makeError) => {
      const { baseFetch, retrying } = wrapped(makeError(), okResponse());

      const response = await retrying(url, init);

      expect(response.status).toBe(200);
      expect(baseFetch).toHaveBeenCalledTimes(2);
    });

    it("should retry when the reset is a bare error without a cause", async () => {
      const bareReset = Object.assign(new Error("socket hang up"), { code: "ECONNRESET" });
      const { baseFetch, retrying } = wrapped(bareReset, okResponse());

      const response = await retrying(url, init);

      expect(response.status).toBe(200);
      expect(baseFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("when the failure is a real answer", () => {
    it("should not retry a PostgREST error that carries a code, even on a 502", async () => {
      const postgrestError = new Response(
        JSON.stringify({ code: "PGRST002", message: kongMessage }),
        { status: 502 },
      );
      const { baseFetch, retrying } = wrapped(postgrestError);

      const response = await retrying(url, init);

      expect(response.status).toBe(502);
      expect(baseFetch).toHaveBeenCalledTimes(1);
    });

    it("should not retry a PostgREST JSON 500", async () => {
      const serverError = new Response(JSON.stringify({ code: "XX000", message: "boom" }), {
        status: 500,
      });
      const { baseFetch, retrying } = wrapped(serverError);

      const response = await retrying(url, init);

      expect(response.status).toBe(500);
      expect(baseFetch).toHaveBeenCalledTimes(1);
    });

    it("should not retry a 502 with some other body", async () => {
      const { baseFetch, retrying } = wrapped(new Response("Bad gateway", { status: 502 }));

      const response = await retrying(url, init);

      expect(response.status).toBe(502);
      expect(baseFetch).toHaveBeenCalledTimes(1);
    });

    it("should not retry a 503 that carries the gateway sentence", async () => {
      const { baseFetch, retrying } = wrapped(new Response(kongMessage, { status: 503 }));

      const response = await retrying(url, init);

      expect(response.status).toBe(503);
      expect(baseFetch).toHaveBeenCalledTimes(1);
    });

    it.each([400, 401, 404, 409])("should not retry a %i", async (status) => {
      const { baseFetch, retrying } = wrapped(new Response(kongMessage, { status }));

      const response = await retrying(url, init);

      expect(response.status).toBe(status);
      expect(baseFetch).toHaveBeenCalledTimes(1);
    });

    it("should not retry a failure that is not a connection reset", async () => {
      const aborted = new DOMException("The operation was aborted", "AbortError");
      const { baseFetch, retrying } = wrapped(aborted);

      await expect(retrying(url, init)).rejects.toBe(aborted);
      expect(baseFetch).toHaveBeenCalledTimes(1);
    });

    it("should leave the body readable when it does not retry", async () => {
      const { retrying } = wrapped(
        new Response(JSON.stringify({ code: "23505", message: "duplicate" }), { status: 409 }),
        new Response("Bad gateway", { status: 502 }),
      );

      const conflict = await retrying(url, init);
      const badGateway = await retrying(url, init);

      expect(await conflict.json()).toEqual({ code: "23505", message: "duplicate" });
      expect(await badGateway.text()).toBe("Bad gateway");
    });
  });

  describe("when the retry fails too", () => {
    it("should retry at most once and return the second bad gateway", async () => {
      const { baseFetch, retrying } = wrapped(
        kongPlainTextBadGateway(),
        kongPlainTextBadGateway(),
        okResponse(),
      );

      const response = await retrying(url, init);

      expect(response.status).toBe(502);
      expect(await response.text()).toBe(kongMessage);
      expect(baseFetch).toHaveBeenCalledTimes(2);
    });

    it("should retry at most once and throw the second connection reset", async () => {
      const secondReset = connectionReset();
      const { baseFetch, retrying } = wrapped(connectionReset(), secondReset, okResponse());

      await expect(retrying(url, init)).rejects.toBe(secondReset);
      expect(baseFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("when the request body cannot be sent twice", () => {
    it("should not retry a streamed body", async () => {
      const reset = connectionReset();
      const { baseFetch, retrying } = wrapped(reset, okResponse());
      const streamedInit = {
        method: "POST",
        body: new ReadableStream<Uint8Array>(),
        duplex: "half",
      };

      await expect(retrying(url, streamedInit)).rejects.toBe(reset);
      expect(baseFetch).toHaveBeenCalledTimes(1);
    });

    it("should not retry a request object that carries a body", async () => {
      const bad = kongPlainTextBadGateway();
      const { baseFetch, retrying } = wrapped(bad, okResponse());
      const request = new Request(url, { method: "POST", body: "{}" });

      const response = await retrying(request);

      expect(response).toBe(bad);
      expect(baseFetch).toHaveBeenCalledTimes(1);
    });
  });
});
