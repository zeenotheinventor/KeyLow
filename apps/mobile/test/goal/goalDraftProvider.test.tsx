import { act, renderHook } from "@testing-library/react-native";

import { GoalDraftProvider, useGoalDraft } from "../../components/GoalQuestionnaire";

import type { GoalDraftAnswers } from "../../components/GoalQuestionnaire";
import type { ReactNode } from "react";

function providerWith(initialAnswers?: GoalDraftAnswers) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <GoalDraftProvider initialAnswers={initialAnswers}>{children}</GoalDraftProvider>;
  };
}

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

describe("the goal draft provider", () => {
  it("should start with nothing answered and an empty focus", async () => {
    const { result } = await renderHook(() => useGoalDraft(), { wrapper: providerWith() });

    expect(result.current.draft).toStrictEqual({ focus: [] });
  });

  it("should start from the current goal's answers when it is given them", async () => {
    const { result } = await renderHook(() => useGoalDraft(), {
      wrapper: providerWith({ goal: "strength", focus: ["legs"], days_per_week: 3 }),
    });

    expect(result.current.draft).toStrictEqual({
      goal: "strength",
      focus: ["legs"],
      days_per_week: 3,
    });
  });

  it("should keep an answer given through it", async () => {
    const { result } = await renderHook(() => useGoalDraft(), { wrapper: providerWith() });

    await act(() => {
      result.current.answer({ days_per_week: 4 });
    });

    expect(result.current.draft.days_per_week).toBe(4);
  });

  it("should say the answers have not changed until one is given, or the same one is given again", async () => {
    const { result } = await renderHook(() => useGoalDraft(), {
      wrapper: providerWith({ goal: "strength", focus: ["legs"] }),
    });
    expect(result.current.hasChanges).toBe(false);

    await act(() => {
      result.current.answer({ goal: "strength" });
    });
    expect(result.current.hasChanges).toBe(false);

    await act(() => {
      result.current.answer({ goal: "hybrid" });
    });
    expect(result.current.hasChanges).toBe(true);

    await act(() => {
      result.current.answer({ goal: "strength" });
    });
    expect(result.current.hasChanges).toBe(false);
  });

  it("should start over from the answers given to restart, and count changes against them", async () => {
    const { result } = await renderHook(() => useGoalDraft(), {
      wrapper: providerWith({ goal: "strength", focus: ["legs"], days_per_week: 3 }),
    });
    await act(() => {
      result.current.answer({ days_per_week: 5 });
    });
    expect(result.current.hasChanges).toBe(true);

    await act(() => {
      result.current.restart({ goal: "hybrid", focus: ["arms"], days_per_week: 4 });
    });

    expect(result.current.draft).toStrictEqual({
      goal: "hybrid",
      focus: ["arms"],
      days_per_week: 4,
    });
    expect(result.current.hasChanges).toBe(false);

    await act(() => {
      result.current.answer({ days_per_week: 3 });
    });
    expect(result.current.hasChanges).toBe(true);
  });

  it("should refuse to be used outside a provider", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(renderHook(() => useGoalDraft())).rejects.toThrow(
      "useGoalDraft must be used inside a GoalDraftProvider",
    );
  });
});
