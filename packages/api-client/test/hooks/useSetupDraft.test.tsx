import { renderHook } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it } from "vitest";

import { useSetupDraft } from "../../src";

import type { SetupState } from "../../src";

const TODAY = "2026-10-23";

const savedAccount: SetupState = {
  isSetUp: true,
  stats: {
    sex: "male",
    birthDate: "1991-03-14",
    heightCm: 180,
    activity: "light",
    weightUnit: "kg",
  },
  program: {
    id: "66666666-6666-4666-8666-666666666666",
    goal: "lose",
    ratePctPerWeek: 0.5,
    proteinGPerKg: 1.6,
    fatFraction: 0.4,
    splitPreset: "balanced",
  },
  latestWeighIn: { weightKg: 80, localDate: "2026-10-21" },
};

describe("useSetupDraft", () => {
  it("should start on the sex step with nothing answered while the saved answers are not read", () => {
    const { result } = renderHook(() => useSetupDraft(undefined, TODAY, "GB"));

    expect(result.current.state.step).toBe("sex");
    expect(result.current.state.draft).toEqual({});
    expect(result.current.state.hasLoadedSavedAnswers).toBe(false);
  });

  it("should lay the saved answers into the draft once they arrive", () => {
    const { result, rerender } = renderHook(
      ({ setupState }: { setupState: SetupState | undefined }) =>
        useSetupDraft(setupState, TODAY, "GB"),
      { initialProps: { setupState: undefined as SetupState | undefined } },
    );

    rerender({ setupState: savedAccount });

    expect(result.current.state.hasLoadedSavedAnswers).toBe(true);
    expect(result.current.state.draft).toMatchObject({
      sex: "male",
      birthDate: "1991-03-14",
      heightCm: 180,
      weightKg: 80,
      goal: "lose",
      ratePctPerWeek: 0.5,
    });
    expect(result.current.state.weightFromWeighInOn).toBe("2026-10-21");
  });

  it("should keep what the person answered while the saved answers were loading", () => {
    const { result, rerender } = renderHook(
      ({ setupState }: { setupState: SetupState | undefined }) =>
        useSetupDraft(setupState, TODAY, "GB"),
      { initialProps: { setupState: undefined as SetupState | undefined } },
    );

    act(() => {
      result.current.dispatch({ type: "sexChosen", sex: "female" });
    });
    rerender({ setupState: savedAccount });

    expect(result.current.state.draft.sex).toBe("female");
  });

  it("should open a step by its address", () => {
    const { result } = renderHook(() => useSetupDraft(undefined, TODAY, "GB"));

    act(() => {
      result.current.dispatch({ type: "stepOpened", step: "protein" });
    });

    expect(result.current.state.step).toBe("protein");
    expect(result.current.state.draft.proteinPreset).toBe("moderate");
  });
});
