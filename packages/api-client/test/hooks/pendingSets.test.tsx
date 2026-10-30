import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { isPendingSetId, usePendingSets, withPendingSets } from "../../src/hooks/pendingSets";

import type { ScreenSet } from "../../src/hooks/sessionViewTypes";

const set = (id: string, position: number): ScreenSet => ({
  id,
  session_id: "00000000-0000-4000-8000-000000000001",
  exercise_id: "00000000-0000-4000-8000-000000000002",
  position,
  set_type: "working",
  reps: 10,
  load_kg: 100,
  rir: 2,
  rpe: null,
  performed_at: "2026-10-15T18:30:00Z",
  deleted_at: null,
});

describe("isPendingSetId", () => {
  it("should tell a set being saved from a stored one", () => {
    expect(isPendingSetId("pending-1")).toBe(true);
    expect(isPendingSetId("00000009-0000-4000-8000-000000000001")).toBe(false);
  });
});

describe("withPendingSets", () => {
  it("should draw a set being saved after the stored ones", () => {
    const stored = [set("a", 0)];

    expect(
      withPendingSets(stored, [{ set: set("pending-1", 1), savedId: null }]).map(({ id }) => id),
    ).toEqual(["a", "pending-1"]);
  });

  it("should leave a set out once the stored sets hold it", () => {
    const stored = [set("a", 0), set("b", 1)];

    expect(withPendingSets(stored, [{ set: set("pending-1", 1), savedId: "b" }])).toBe(stored);
  });
});

describe("usePendingSets", () => {
  it("should add a set, record its stored id and drop the ones the stored sets hold", () => {
    const { result } = renderHook(() => usePendingSets());

    act(() => {
      result.current.add(set("pending-1", 0));
      result.current.add(set("pending-2", 1));
    });
    act(() => {
      result.current.markSaved("pending-1", "stored-1");
    });
    act(() => {
      result.current.prune(new Set(["stored-1"]));
    });

    expect(result.current.sets.map((entry) => entry.set.id)).toEqual(["pending-2"]);
  });

  it("should take back a set whose write failed", () => {
    const { result } = renderHook(() => usePendingSets());
    act(() => {
      result.current.add(set("pending-1", 0));
    });

    act(() => {
      result.current.drop("pending-1");
    });

    expect(result.current.sets).toEqual([]);
  });
});
