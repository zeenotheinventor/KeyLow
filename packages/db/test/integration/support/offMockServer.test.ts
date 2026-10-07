import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createOffMockClient } from "./offMock";
import { startOffMock } from "./offMockServer";

import type { OffMockServer } from "./offMockServer";

const testPort = 54398;
const baseUrl = `http://127.0.0.1:${testPort}`;
const client = createOffMockClient(baseUrl);

let server: OffMockServer;

beforeAll(async () => {
  server = await startOffMock(testPort);
});

afterAll(async () => {
  await server.close();
});

async function getProduct(code: string, headers: Record<string, string> = {}) {
  const response = await fetch(`${baseUrl}/api/v2/product/${code}?fields=code,product_name`, {
    headers,
  });
  const body: unknown = await response.json();
  return { status: response.status, body };
}

describe("the OFF mock server", () => {
  it("answers an unregistered code like Open Food Facts does for an unknown product", async () => {
    const { status, body } = await getProduct("2000000000010");

    expect(status).toBe(404);
    expect(body).toEqual({
      code: "2000000000010",
      status: 0,
      status_verbose: "product not found",
    });
  });

  it("serves a fixture wrapped in the v2 envelope, under the registered code", async () => {
    await client.register({ code: "2000000000027", fixture: "kcal-present" });

    const { status, body } = await getProduct("2000000000027");

    expect(status).toBe(200);
    expect(body).toMatchObject({
      code: "2000000000027",
      status: 1,
      product: { code: "2000000000027", product_name_en: "Test Oat Crunch" },
    });
  });

  it("applies product overrides after the code", async () => {
    await client.register({
      code: "2000000000034",
      fixture: "kcal-present",
      productOverrides: { code: "not-a-code" },
    });

    const { body } = await getProduct("2000000000034");

    expect(body).toMatchObject({ product: { code: "not-a-code" } });
  });

  it("serves a raw body with its status", async () => {
    await client.register({
      code: "2000000000041",
      status: 500,
      body: { error: "boom" },
    });

    const { status, body } = await getProduct("2000000000041");

    expect(status).toBe(500);
    expect(body).toEqual({ error: "boom" });
  });

  it("holds a response back for the registered delay, after recording the request", async () => {
    await client.register({
      code: "2000000000096",
      fixture: "kcal-present",
      delayMilliseconds: 300,
    });

    const started = Date.now();
    const pending = getProduct("2000000000096");
    await new Promise((resolve) => setTimeout(resolve, 100));
    const callsWhileHeld = await client.calls("2000000000096");
    await pending;

    expect(callsWhileHeld).toHaveLength(1);
    expect(Date.now() - started).toBeGreaterThanOrEqual(280);
  });

  it("rejects a fixture name that is not a plain file name", async () => {
    await expect(
      client.register({ code: "2000000000058", fixture: "../../../package" }),
    ).rejects.toThrow(/fixture/i);
  });

  it("records each request with its headers, per code", async () => {
    await client.register({ code: "2000000000065", fixture: "kcal-present" });
    await getProduct("2000000000065", { "User-Agent": "mock-test/1.0" });
    await getProduct("2000000000065");
    await getProduct("2000000000072");

    const calls = await client.calls("2000000000065");

    expect(calls).toHaveLength(2);
    expect(calls[0]?.headers["user-agent"]).toBe("mock-test/1.0");
    expect(calls[0]?.query["fields"]).toBe("code,product_name");
    expect(await client.calls("2000000000072")).toHaveLength(1);
  });

  it("forgets registrations and calls on reset", async () => {
    await client.register({ code: "2000000000089", fixture: "kcal-present" });
    await getProduct("2000000000089");

    await client.reset();

    expect(await client.calls("2000000000089")).toEqual([]);
    expect((await getProduct("2000000000089")).status).toBe(404);
  });
});
