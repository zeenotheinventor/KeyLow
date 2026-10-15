// @vitest-environment jsdom
// The hook needs a DOM to render in. The rest of the integration suite runs in node.
import { customFoodInputSchema } from "@keylow/core/schemas";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { deleteGeneratedFoods } from "./support/foods";
import { generateBarcode, offMock } from "./support/offProduct";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { useFoodByBarcode } from "../../src/hooks/useFoodByBarcode";
import { createFood, fetchOffProduct } from "../../src/repos";
import { createWrapper } from "../support/wrapper";

import type { TestUser } from "./support/users";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MockInstance } from "vitest";

let user: TestUser;
let invoke: MockInstance<SupabaseClient["functions"]["invoke"]>;

beforeAll(async () => {
  user = await createTestUser("k51");

  // client.functions is a getter that builds a new FunctionsClient on every access, so it is
  // pinned to one instance before that instance's invoke is spied on (ruling 14).
  const functionsClient = user.client.functions;
  vi.spyOn(user.client, "functions", "get").mockReturnValue(functionsClient);
  invoke = vi.spyOn(functionsClient, "invoke");
});

beforeEach(() => {
  invoke.mockClear();
});

afterEach(() => {
  cleanup();
});

afterAll(async () => {
  try {
    await deleteGeneratedFoods();
  } finally {
    // The user's own foods and portions go with them (on delete cascade).
    await deleteCreatedTestUsers();
  }
});

/** A lookup as a screen makes it: the signed in client with the spied `functions`, and a cache of its own. */
function lookUpAsNewScreen(code: string) {
  const { wrapper } = createWrapper(user.client);
  return renderHook(() => useFoodByBarcode(code), { wrapper });
}

describe("useFoodByBarcode against the served off-product function", () => {
  it("should invoke off-product for the first scan and serve the second from the local database", async () => {
    const code = generateBarcode();
    await offMock.register({ code, fixture: "kcal-present" });

    const first = lookUpAsNewScreen(code);
    await waitFor(
      () => {
        expect(first.result.current.result?.status).toBe("found");
      },
      {
        timeout: 20_000,
      },
    );

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("off-product", { body: { code } });
    expect(await offMock.calls(code)).toHaveLength(1);
    const firstResult = first.result.current.result;
    expect(firstResult).toMatchObject({
      status: "found",
      food: { source: "off", source_ref: code, barcode: code, owner_id: null },
    });
    first.unmount();
    // The second screen starts counting from nothing.
    invoke.mockClear();

    const second = lookUpAsNewScreen(code);
    await waitFor(
      () => {
        expect(second.result.current.result?.status).toBe("found");
      },
      {
        timeout: 20_000,
      },
    );

    expect(invoke).not.toHaveBeenCalled();
    expect(await offMock.calls(code)).toHaveLength(1);
    expect(second.result.current.result).toEqual(firstResult);
    second.unmount();
  });

  it("should resolve to not_found for a barcode Open Food Facts does not know", async () => {
    const code = generateBarcode();

    const lookup = lookUpAsNewScreen(code);
    await waitFor(
      () => {
        expect(lookup.result.current.result?.status).toBe("not_found");
      },
      {
        timeout: 20_000,
      },
    );

    expect(lookup.result.current.result).toEqual({ status: "not_found", code });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(await offMock.calls(code)).toHaveLength(1);
    lookup.unmount();
  });

  it("should resolve a barcode to the user's own food rather than the global one", async () => {
    const code = generateBarcode();
    await offMock.register({ code, fixture: "kcal-present" });
    const product = await fetchOffProduct(user.client, code);
    const { food: ownFood } = await createFood(
      user.client,
      user.id,
      customFoodInputSchema.parse({
        name: "My own oat crunch",
        barcode: code,
        basis: "per_100g",
        kcal: 400,
        protein_g: 10,
        fat_g: 8,
        carbs_g: 60,
        portions: [],
      }),
    );
    // Setting the rows up went through off-product too. The lookup is what is counted.
    invoke.mockClear();

    const lookup = lookUpAsNewScreen(code);
    await waitFor(
      () => {
        expect(lookup.result.current.result?.status).toBe("found");
      },
      {
        timeout: 20_000,
      },
    );

    expect(product?.food.id).not.toBe(ownFood.id);
    expect(lookup.result.current.result).toMatchObject({
      status: "found",
      food: { id: ownFood.id },
    });
    expect(invoke).not.toHaveBeenCalled();
    lookup.unmount();
  });
});
