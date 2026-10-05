import { FunctionsHttpError } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { createTestClient } from "./createTestClient";
import { invokeEdgeFunction } from "../src/edge";

// client.functions is a getter that builds a new FunctionsClient on every access,
// so the getter is pinned to one instance before that instance's invoke is spied on.
function spyOnInvoke(client: ReturnType<typeof createTestClient>) {
  const functionsClient = client.functions;
  vi.spyOn(client, "functions", "get").mockReturnValue(functionsClient);
  return vi.spyOn(functionsClient, "invoke");
}

describe("invokeEdgeFunction", () => {
  it("should return the data of the invoked function", async () => {
    const client = createTestClient();
    const invoke = spyOnInvoke(client).mockResolvedValue({
      data: { results: ["oats"] },
      error: null,
    });

    const response = await invokeEdgeFunction<{ results: string[] }>(client, "off-search", {
      query: "oats",
    });

    expect(response).toEqual({ results: ["oats"] });
    expect(invoke).toHaveBeenCalledWith("off-search", { body: { query: "oats" } });
  });

  it("should throw an error naming the function and carrying the cause when the invocation fails", async () => {
    const client = createTestClient();
    const failure = new FunctionsHttpError(new Response());
    spyOnInvoke(client).mockResolvedValue({ data: null, error: failure });

    const rejection = invokeEdgeFunction(client, "run-checkin");
    await expect(rejection).rejects.toThrow(/run-checkin/);
    await expect(rejection).rejects.toHaveProperty("cause", failure);
  });

  it("should throw an error naming the function when it returns no data", async () => {
    const client = createTestClient();
    spyOnInvoke(client).mockResolvedValue({ data: null, error: null });

    await expect(invokeEdgeFunction(client, "off-product")).rejects.toThrow(/off-product/);
  });
});
