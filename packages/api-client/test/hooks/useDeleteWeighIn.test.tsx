import { act, renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useDeleteWeighIn } from "../../src/hooks/useDeleteWeighIn";
import { useWeighIns } from "../../src/hooks/useWeighIns";
import { keys } from "../../src/queryKeys";
import { installWeighInsFake, weighInRow } from "../support/weighIns";
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

const newer = weighInRow({ local_date: "2026-10-15", measured_at: "2026-10-15T07:00:00+00:00" });
const older = weighInRow({
  local_date: "2026-10-14",
  measured_at: "2026-10-14T07:00:00+00:00",
  source: "health_connect",
});

const renderList = async (fake: ReturnType<typeof installWeighInsFake>) => {
  const rendered = createWrapper();
  const hook = renderHook(() => ({ list: useWeighIns(), remove: useDeleteWeighIn() }), {
    wrapper: rendered.wrapper,
  });
  await waitFor(() => {
    expect(hook.result.current.list.isSuccess).toBe(true);
  });
  return { ...rendered, ...hook, fake };
};

describe("useDeleteWeighIn", () => {
  it("should soft delete the weigh-in, whatever its source, and leave the other", async () => {
    const fake = installWeighInsFake(server, [newer, older]);
    const { result } = await renderList(fake);

    await act(() => result.current.remove.mutateAsync(older));

    expect(fake.rows.map((row) => [row.id, row.deleted_at === null])).toEqual([
      [newer.id, true],
      [older.id, false],
    ]);
    await waitFor(() => {
      expect(result.current.list.data).toEqual([newer]);
    });
  });

  it("should take the weigh-in out of the list at once, while the request is still on its way", async () => {
    const fake = installWeighInsFake(server, [newer, older]);
    const { queryClient, result } = await renderList(fake);
    const releaseWrites = fake.holdWrites();

    act(() => {
      result.current.remove.mutate(newer);
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(keys.weighIns.list)).toEqual([older]);
    });
    expect(result.current.remove.isPending).toBe(true);
    releaseWrites();
    await waitFor(() => {
      expect(result.current.remove.isSuccess).toBe(true);
    });
  });

  it("should put the weigh-in back in its place when the request fails", async () => {
    const fake = installWeighInsFake(server, [newer, older]);
    const { queryClient, result } = await renderList(fake);
    fake.failWith("XX000");

    await act(async () => {
      await result.current.remove.mutateAsync(newer).catch(() => undefined);
    });

    expect(result.current.remove.error?.message).toBe("Could not delete the weigh-in (XX000)");
    fake.failWith(null);
    await waitFor(() => {
      expect(queryClient.getQueryData(keys.weighIns.list)).toEqual([newer, older]);
    });
  });
});
