import { buildManualWeighIn } from "@keylow/core/weight";
import { act, renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useAddWeighIn } from "../../src/hooks/useAddWeighIn";
import { useWeighIns } from "../../src/hooks/useWeighIns";
import {
  RECOGNISABLE_NOTE,
  RECOGNISABLE_WEIGHT,
  installWeighInsFake,
  weighInRow,
} from "../support/weighIns";
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

const input = buildManualWeighIn({
  weightKg: RECOGNISABLE_WEIGHT,
  measuredAt: new Date("2026-10-16T07:30:00Z"),
  note: RECOGNISABLE_NOTE,
  timeZone: "Europe/London",
});

describe("useAddWeighIn", () => {
  it("should add the weigh-in and refresh the list so it shows at the top", async () => {
    const existing = weighInRow({ local_date: "2026-10-15" });
    installWeighInsFake(server, [existing]);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => ({ list: useWeighIns(), add: useAddWeighIn() }), {
      wrapper,
    });
    await waitFor(() => {
      expect(result.current.list.isSuccess).toBe(true);
    });

    await act(() => result.current.add.mutateAsync(input));

    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(2);
    });
    expect(result.current.list.data?.[0]).toMatchObject({
      local_date: "2026-10-16",
      weight_kg: 81.234,
    });
  });

  it("should reject with an error that holds neither the weight nor the note when the database refuses", async () => {
    const fake = installWeighInsFake(server);
    fake.failWith("23514");
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAddWeighIn(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(input).catch(() => undefined);
    });

    expect(result.current.error?.message).toBe("Could not add the weigh-in (23514)");
    expect(JSON.stringify(result.current.error)).not.toContain("81.234");
    expect(result.current.error?.message).not.toContain(RECOGNISABLE_NOTE);
  });
});
