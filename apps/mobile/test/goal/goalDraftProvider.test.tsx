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

  it("should refuse to be used outside a provider", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(renderHook(() => useGoalDraft())).rejects.toThrow(
      "useGoalDraft must be used inside a GoalDraftProvider",
    );
  });
});
