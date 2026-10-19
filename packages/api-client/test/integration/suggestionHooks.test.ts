// @vitest-environment jsdom
// The hooks need a DOM to render in. The rest of the integration suite runs in node.
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { adminClient } from "./support/stack";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { useSuggestion } from "../../src/hooks/useSuggestion";
import { saveTrainingGoals } from "../../src/repos/trainingGoals";
import { vTaperAnswers } from "../support/trainingGoals";
import { createWrapper } from "../support/wrapper";

// The suggestion over the real tables. The profile's time zone is UTC (the column's default). No test
// names an exercise of the library: what is checked is the equipment of whatever is suggested.

const NOW = "2026-10-17T12:00:00Z";
const DAY = "2026-10-17";

afterEach(() => {
  cleanup();
});

afterAll(async () => {
  await deleteCreatedTestUsers();
});

describe("useSuggestion over the real tables", () => {
  it("should suggest a session of dumbbell exercises only to a user with dumbbells only", async () => {
    const user = await createTestUser("key405");
    await saveTrainingGoals(user.client, { ...vTaperAnswers, equipment: ["dumbbell"] });
    const { wrapper } = createWrapper(user.client);

    const { result } = renderHook(() => useSuggestion({ day: DAY, now: NOW }), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const suggestion = result.current.data?.suggestion;
    if (suggestion?.kind !== "session") {
      throw new Error("Expected a fresh session for a user with no routine");
    }
    expect(suggestion.exercises.length).toBeGreaterThan(0);
    const { data, error } = await adminClient()
      .from("exercises")
      .select("id,equipment")
      .in(
        "id",
        suggestion.exercises.map(({ exercise_id }) => exercise_id),
      );
    expect(error).toBeNull();
    expect(data).toHaveLength(suggestion.exercises.length);
    expect(data?.every(({ equipment }) => equipment === "dumbbell")).toBe(true);
  });

  it("should say no_goal for a user who has not answered the questionnaire", async () => {
    const user = await createTestUser("key405");
    const { wrapper } = createWrapper(user.client);

    const { result } = renderHook(() => useSuggestion({ day: DAY, now: NOW }), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data).toEqual({ kind: null, suggestion: null, unavailable: "no_goal" });
  });
});
