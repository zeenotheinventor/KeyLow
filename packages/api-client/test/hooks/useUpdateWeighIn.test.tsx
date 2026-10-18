import { act, renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useUpdateWeighIn } from "../../src/hooks/useUpdateWeighIn";
import { useWeighIns } from "../../src/hooks/useWeighIns";
import { WeighInNotEditableError } from "../../src/repos/weighIns";
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

const renderList = async () => {
  const rendered = createWrapper();
  const hook = renderHook(() => ({ list: useWeighIns(), update: useUpdateWeighIn() }), {
    wrapper: rendered.wrapper,
  });
  await waitFor(() => {
    expect(hook.result.current.list.isSuccess).toBe(true);
  });
  return { ...rendered, ...hook };
};

describe("useUpdateWeighIn", () => {
  it("should change a manual weigh-in and refresh the list", async () => {
    const manual = weighInRow({ source: "manual", weight_kg: 80 });
    installWeighInsFake(server, [manual]);
    const { result } = await renderList();

    await act(() =>
      result.current.update.mutateAsync({ id: manual.id, change: { weight_kg: 79.5 } }),
    );

    await waitFor(() => {
      expect(result.current.list.data?.[0]?.weight_kg).toBe(79.5);
    });
  });

  it("should reject an imported weigh-in as not editable, without its value in the error", async () => {
    const imported = weighInRow({ source: "health_connect", weight_kg: RECOGNISABLE_WEIGHT });
    installWeighInsFake(server, [imported]);
    const { result } = await renderList();

    await act(async () => {
      await result.current.update
        .mutateAsync({ id: imported.id, change: { note: RECOGNISABLE_NOTE } })
        .catch(() => undefined);
    });

    expect(result.current.update.error).toBeInstanceOf(WeighInNotEditableError);
    expect(JSON.stringify(result.current.update.error)).not.toContain(RECOGNISABLE_NOTE);
    expect(result.current.update.error?.message).not.toContain("81.234");
    expect(result.current.list.data?.[0]?.weight_kg).toBe(RECOGNISABLE_WEIGHT);
  });
});
