import { act, renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useAddRecipesToList } from "../../src/hooks/useAddRecipesToList";
import { useAddShoppingItem } from "../../src/hooks/useAddShoppingItem";
import { useClearTickedItems } from "../../src/hooks/useClearTickedItems";
import { useRemoveShoppingItem } from "../../src/hooks/useRemoveShoppingItem";
import { useShoppingList } from "../../src/hooks/useShoppingList";
import { useShoppingPreview } from "../../src/hooks/useShoppingPreview";
import { useToggleShoppingItem } from "../../src/hooks/useToggleShoppingItem";
import { keys } from "../../src/queryKeys";
import {
  BEEF_ID,
  CHILLI_ID,
  CURRY_ID,
  ONION_ID,
  SALT_ID,
  installShoppingListFake,
  shoppingItemRow,
} from "../support/shoppingList";
import { createWrapper } from "../support/wrapper";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const TICKED_AT = "2026-10-29T10:00:00+00:00";

const renderList = async (fake: ReturnType<typeof installShoppingListFake>) => {
  const rendered = createWrapper();
  const hook = renderHook(
    () => ({
      list: useShoppingList(),
      addRecipes: useAddRecipesToList(),
      addItem: useAddShoppingItem(),
      toggle: useToggleShoppingItem(),
      remove: useRemoveShoppingItem(),
      clear: useClearTickedItems(),
    }),
    { wrapper: rendered.wrapper },
  );
  await waitFor(() => {
    expect(hook.result.current.list.isSuccess).toBe(true);
  });
  return { ...rendered, ...hook, fake };
};

describe("useShoppingPreview", () => {
  it("should sum the recipes at the servings chosen and leave the staples out", async () => {
    installShoppingListFake(server);
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () =>
        useShoppingPreview([
          { id: CHILLI_ID, servings: 2 },
          { id: CURRY_ID, servings: 2 },
        ]),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    if (result.current.status !== "ready") {
      throw new Error("The preview must be ready");
    }
    expect(
      result.current.preview.items.map(({ name, grams, portionCount }) => [
        name,
        grams,
        portionCount,
      ]),
    ).toEqual([
      ["Beef mince", 500, null],
      ["Onions", 300, 2],
    ]);
    expect(result.current.preview.staples.map(({ foodId }) => foodId)).toEqual([SALT_ID]);
  });

  it("should be an error with a retry when the recipes cannot be read", async () => {
    const fake = installShoppingListFake(server);
    fake.failWith("XX000");
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useShoppingPreview([{ id: CHILLI_ID, servings: 4 }]), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });
  });
});

describe("useAddRecipesToList", () => {
  it("should merge into the open row, add the rest at the end and leave the staples out, in one write", async () => {
    const open = shoppingItemRow({ position: 3 });
    const fake = installShoppingListFake(server, [open]);
    const { result } = await renderList(fake);

    await act(() =>
      result.current.addRecipes.mutateAsync({ recipes: [{ id: CURRY_ID, servings: 2 }] }),
    );

    expect(fake.requests.filter(({ method }) => method === "RPC")).toHaveLength(1);
    expect(
      fake.rows.map(({ food_id, grams, portion_count, position }) => [
        food_id,
        grams,
        portion_count,
        position,
      ]),
    ).toEqual([
      [ONION_ID, 450, 3, 3],
      [BEEF_ID, 250, null, 4],
    ]);
    expect(fake.rows[0]?.sources.map(({ name }) => name)).toEqual(["Chilli", "Curry"]);
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(2);
    });
  });

  it("should add a staple the person chose to add anyway", async () => {
    const fake = installShoppingListFake(server);
    const { result } = await renderList(fake);

    await act(() =>
      result.current.addRecipes.mutateAsync({
        recipes: [{ id: CHILLI_ID, servings: 4 }],
        addAnyway: [SALT_ID],
      }),
    );

    expect(fake.rows.map(({ name }) => name)).toEqual(["Beef mince", "Onions", "Salt"]);
  });

  it("should never change a ticked row", async () => {
    const ticked = shoppingItemRow({ checked_at: TICKED_AT });
    const fake = installShoppingListFake(server, [ticked]);
    const { result } = await renderList(fake);

    await act(() =>
      result.current.addRecipes.mutateAsync({ recipes: [{ id: CURRY_ID, servings: 2 }] }),
    );

    expect(fake.rows[0]).toEqual(ticked);
    expect(fake.rows.filter(({ food_id }) => food_id === ONION_ID)).toHaveLength(2);
  });

  it("should reject servings that cannot be chosen before it writes anything", async () => {
    const fake = installShoppingListFake(server);
    const { result } = await renderList(fake);

    await act(async () => {
      await expect(
        result.current.addRecipes.mutateAsync({ recipes: [{ id: CHILLI_ID, servings: 0 }] }),
      ).rejects.toThrow(RangeError);
    });

    expect(fake.requests.filter(({ method }) => method !== "GET")).toEqual([]);
  });
});

describe("useAddShoppingItem", () => {
  it("should add a typed item at the end of the list", async () => {
    const fake = installShoppingListFake(server, [shoppingItemRow({ position: 5 })]);
    const { result } = await renderList(fake);

    await act(() => result.current.addItem.mutateAsync("  Bin bags "));

    expect(fake.rows[1]).toMatchObject({ name: "Bin bags", food_id: null, position: 6 });
    await waitFor(() => {
      expect(result.current.list.data?.map(({ name }) => name)).toEqual(["Onions", "Bin bags"]);
    });
  });

  it("should send nothing for blank words", async () => {
    const fake = installShoppingListFake(server);
    const { result } = await renderList(fake);
    const before = fake.requests.length;

    await expect(act(() => result.current.addItem.mutateAsync("   "))).resolves.toBeNull();

    expect(fake.requests.slice(before).filter(({ method }) => method !== "GET")).toEqual([]);
  });
});

describe("useToggleShoppingItem", () => {
  it("should tick the item in the cached list at once, while the request is on its way", async () => {
    const item = shoppingItemRow();
    const fake = installShoppingListFake(server, [item]);
    const { queryClient, result } = await renderList(fake);
    const release = fake.holdWrites();

    act(() => {
      result.current.toggle.mutate({ id: item.id, checked: true });
    });

    await waitFor(() => {
      expect(
        queryClient.getQueryData<typeof fake.rows>(keys.shoppingList.items)?.[0]?.checked_at,
      ).not.toBeNull();
    });
    expect(result.current.toggle.isPending).toBe(true);
    release();
    await waitFor(() => {
      expect(result.current.toggle.isSuccess).toBe(true);
    });
    expect(fake.rows[0]?.checked_at).not.toBeNull();
  });

  it("should put the tick back when the request fails", async () => {
    const item = shoppingItemRow();
    const fake = installShoppingListFake(server, [item]);
    const { queryClient, result } = await renderList(fake);
    fake.failWith("XX000");

    await act(async () => {
      await result.current.toggle
        .mutateAsync({ id: item.id, checked: true })
        .catch(() => undefined);
    });

    expect(result.current.toggle.error?.message).toBe("Could not tick the item (XX000)");
    fake.failWith(null);
    await waitFor(() => {
      expect(queryClient.getQueryData(keys.shoppingList.items)).toEqual([item]);
    });
  });
});

describe("useRemoveShoppingItem", () => {
  it("should take the item out of the list, and put it back when the request fails", async () => {
    const item = shoppingItemRow();
    const fake = installShoppingListFake(server, [item]);
    const { queryClient, result } = await renderList(fake);
    fake.failWith("XX000");

    await act(async () => {
      await result.current.remove.mutateAsync(item.id).catch(() => undefined);
    });

    expect(result.current.remove.error?.message).toBe("Could not remove the item (XX000)");
    fake.failWith(null);
    await waitFor(() => {
      expect(queryClient.getQueryData(keys.shoppingList.items)).toEqual([item]);
    });

    await act(() => result.current.remove.mutateAsync(item.id));

    expect(fake.rows).toEqual([]);
  });
});

describe("useClearTickedItems", () => {
  it("should clear the ticked items and keep what is still to buy", async () => {
    const open = shoppingItemRow();
    const ticked = shoppingItemRow({ position: 1, checked_at: TICKED_AT });
    const fake = installShoppingListFake(server, [open, ticked]);
    const { result } = await renderList(fake);

    await act(() => result.current.clear.mutateAsync());

    expect(fake.rows).toEqual([open]);
    await waitFor(() => {
      expect(result.current.list.data).toEqual([open]);
    });
  });
});
