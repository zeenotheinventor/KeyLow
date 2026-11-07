import { describe, expect, it, vi } from "vitest";

import { retryTransportFailure } from "../src/retryTransportFailure.ts";

const noCode = () =>
  new Error("Could not mark the day (An invalid response was received from the upstream server)", {
    cause: { code: undefined },
  });
const failedFetch = () =>
  new Error("Could not mark the day (TypeError: fetch failed)", { cause: { code: "" } });
const databaseRefusal = () =>
  new Error("Could not mark the day (23514)", { cause: { code: "23514" } });

describe("retryTransportFailure", () => {
  it("should give back what the write returns without running it again", async () => {
    const write = vi.fn().mockResolvedValue("done");

    await expect(retryTransportFailure(write)).resolves.toBe("done");
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("should run the write again when the gateway answered with no code", async () => {
    const write = vi.fn().mockRejectedValueOnce(noCode()).mockResolvedValue("done");

    await expect(retryTransportFailure(write)).resolves.toBe("done");
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("should run the write again when the fetch itself failed", async () => {
    const write = vi.fn().mockRejectedValueOnce(failedFetch()).mockResolvedValue("done");

    await expect(retryTransportFailure(write)).resolves.toBe("done");
  });

  it("should not run the write again when the database refused it, so a real failure shows", async () => {
    const write = vi.fn().mockRejectedValue(databaseRefusal());

    await expect(retryTransportFailure(write)).rejects.toThrow("Could not mark the day (23514)");
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("should not run the write again when the error is not a request failure at all", async () => {
    const write = vi.fn().mockRejectedValue(new TypeError("boom"));

    await expect(retryTransportFailure(write)).rejects.toThrow("boom");
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("should stop after three tries and throw the last error with its real message", async () => {
    const write = vi.fn().mockRejectedValue(noCode());

    await expect(retryTransportFailure(write)).rejects.toThrow(
      "Could not mark the day (An invalid response was received from the upstream server)",
    );
    expect(write).toHaveBeenCalledTimes(3);
  });
});
