import { describe, expect, it } from "vitest";

import { createPageServerHolder } from "../src/pageServerHolder.ts";

import type { PageServer } from "../src/pageServer.ts";

const pages = new Map([["/a", "<p>a</p>"]]);

function fakeStart() {
  const log: string[] = [];
  const start = (served: ReadonlyMap<string, string>): Promise<PageServer> => {
    log.push(`start ${served.size}`);
    return Promise.resolve({
      port: 1,
      close: () => {
        log.push("close");
        return Promise.resolve();
      },
    });
  };
  return { log, start };
}

describe("the page server holder", () => {
  it("should start nothing until a case asks, so a session that needs no page binds no port", async () => {
    const { log, start } = fakeStart();
    const holder = createPageServerHolder(pages, start);

    await holder.stop();

    expect(log).toEqual([]);
  });

  it("should start the server once however many cases ask", async () => {
    const { log, start } = fakeStart();
    const holder = createPageServerHolder(pages, start);

    await Promise.all([holder.ensure(), holder.ensure()]);
    await holder.ensure();

    expect(log).toEqual(["start 1"]);
  });

  it("should close the server it started when stopped, once", async () => {
    const { log, start } = fakeStart();
    const holder = createPageServerHolder(pages, start);
    await holder.ensure();

    await holder.stop();
    await holder.stop();

    expect(log).toEqual(["start 1", "close"]);
  });

  it("should start again after it was stopped", async () => {
    const { log, start } = fakeStart();
    const holder = createPageServerHolder(pages, start);
    await holder.ensure();
    await holder.stop();

    await holder.ensure();

    expect(log).toEqual(["start 1", "close", "start 1"]);
  });

  it("should pass a failed start to the case, try again for the next, and stop without throwing", async () => {
    let attempts = 0;
    const holder = createPageServerHolder(pages, () => {
      attempts += 1;
      return attempts === 1
        ? Promise.reject(new Error("port 24401 is already in use"))
        : Promise.resolve({ port: 1, close: () => Promise.resolve() });
    });

    await expect(holder.ensure()).rejects.toThrow("already in use");
    await expect(holder.ensure()).resolves.toBeUndefined();
    await expect(holder.stop()).resolves.toBeUndefined();
    expect(attempts).toBe(2);
  });
});
