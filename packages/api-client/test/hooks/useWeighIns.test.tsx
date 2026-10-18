import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

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

describe("useWeighIns", () => {
  it("should load the live weigh-ins newest first and cache them under the list key", async () => {
    const older = weighInRow({
      local_date: "2026-10-14",
      measured_at: "2026-10-14T07:00:00+00:00",
    });
    const newer = weighInRow({
      local_date: "2026-10-15",
      measured_at: "2026-10-15T07:00:00+00:00",
    });
    installWeighInsFake(server, [older, newer]);
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useWeighIns(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual([newer, older]);
    expect(queryClient.getQueryData(keys.weighIns.list)).toEqual([newer, older]);
  });

  it("should load every row past the 1,000 a page holds", async () => {
    installWeighInsFake(
      server,
      Array.from({ length: 1100 }, () => weighInRow()),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useWeighIns(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toHaveLength(1100);
  });

  it("should make no request while enabled is false", async () => {
    const fake = installWeighInsFake(server, [weighInRow()]);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useWeighIns({ enabled: false }), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.fetchStatus).toBe("idle");
    expect(fake.requests).toEqual([]);
  });
});
