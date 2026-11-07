import { GOAL_PRESETS_V1, trainingGoalsPayload } from "@keylow/core/training";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  closeTrainingGoals,
  getCurrentTrainingGoals,
  listTrainingGoalsHistory,
  saveTrainingGoals,
  saveTrainingGoalsReturningId,
} from "../../src/repos/trainingGoals";
import { createTestClient } from "../createTestClient";
import {
  GOAL_ROW_ID,
  NEW_GOAL_ROW_ID,
  OTHER_GOAL_ROW_ID,
  RECOGNISABLE_GOAL_TEXT,
  installTrainingGoalsFake,
  strengthAnswers,
  trainingGoalsRow,
  vTaperAnswers,
} from "../support/trainingGoals";

import type { GoalAnswers } from "@keylow/core/training";

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

const rejectionOf = async (call: Promise<unknown>): Promise<Error | null> => {
  try {
    await call;
  } catch (error) {
    return error instanceof Error ? error : new Error("(not an Error)");
  }
  return null;
};

const textOf = (error: Error | null) =>
  JSON.stringify({ message: error?.message, name: error?.name, cause: error?.cause });

describe("getCurrentTrainingGoals", () => {
  it("should resolve to the row of the current goal, parsed", async () => {
    installTrainingGoalsFake(server, { rows: [trainingGoalsRow(vTaperAnswers)] });

    const goals = await getCurrentTrainingGoals(createTestClient());

    expect(goals).toEqual(trainingGoalsRow(vTaperAnswers));
  });

  it("should ask only for the row that has not ended", async () => {
    const fake = installTrainingGoalsFake(server, {
      rows: [
        trainingGoalsRow(strengthAnswers, {
          id: OTHER_GOAL_ROW_ID,
          effective_to: "2026-10-10T09:00:00+00:00",
          effective_from: "2026-10-01T09:00:00+00:00",
        }),
        trainingGoalsRow(vTaperAnswers),
      ],
    });

    const goals = await getCurrentTrainingGoals(createTestClient());

    expect(fake.reads[0]?.searchParams.get("effective_to")).toBe("is.null");
    expect(goals?.id).toBe(GOAL_ROW_ID);
  });

  it("should resolve to null when the user has no goal", async () => {
    installTrainingGoalsFake(server, { rows: [] });

    expect(await getCurrentTrainingGoals(createTestClient())).toBeNull();
  });

  it("should name the row and the fields of a row it cannot read, and never a value", async () => {
    installTrainingGoalsFake(server, {
      rows: [
        trainingGoalsRow(vTaperAnswers, {
          days_per_week: 99,
          goal: RECOGNISABLE_GOAL_TEXT,
        }),
      ],
    });

    const error = await rejectionOf(getCurrentTrainingGoals(createTestClient()));

    expect(error?.message).toContain(GOAL_ROW_ID);
    expect(error?.message).toContain("days_per_week");
    expect(error?.message).toContain("goal");
    expect(textOf(error)).not.toContain(RECOGNISABLE_GOAL_TEXT);
    expect(textOf(error)).not.toContain("99");
  });

  it("should state the action and the database code, and nothing the database said", async () => {
    const fake = installTrainingGoalsFake(server);
    fake.failReadsWith("42501");

    const error = await rejectionOf(getCurrentTrainingGoals(createTestClient()));

    expect(error?.message).toBe("Could not load your training goals (42501)");
    expect(error?.cause).toEqual({ code: "42501" });
    expect(textOf(error)).not.toContain(RECOGNISABLE_GOAL_TEXT);
  });
});

describe("listTrainingGoalsHistory", () => {
  it("should ask for every row, newest first", async () => {
    const fake = installTrainingGoalsFake(server, {
      rows: [
        trainingGoalsRow(vTaperAnswers),
        trainingGoalsRow(strengthAnswers, {
          id: OTHER_GOAL_ROW_ID,
          effective_from: "2026-10-01T09:00:00+00:00",
          effective_to: "2026-10-10T09:00:00+00:00",
        }),
      ],
    });

    const history = await listTrainingGoalsHistory(createTestClient());

    expect(history.map(({ id }) => id)).toEqual([GOAL_ROW_ID, OTHER_GOAL_ROW_ID]);
    expect(fake.reads[0]?.searchParams.get("effective_to")).toBeNull();
    expect(fake.reads[0]?.searchParams.get("order")).toBe("effective_from.desc,id.desc");
  });

  it("should resolve to an empty list when the user has never answered", async () => {
    installTrainingGoalsFake(server, { rows: [] });

    expect(await listTrainingGoalsHistory(createTestClient())).toEqual([]);
  });
});

describe("saveTrainingGoals", () => {
  it("should send the payload core derives from the answers and resolve to the new row", async () => {
    const fake = installTrainingGoalsFake(server, { rows: [trainingGoalsRow(strengthAnswers)] });

    const saved = await saveTrainingGoals(createTestClient(), vTaperAnswers);

    expect(fake.saves).toEqual([{ p_goals: trainingGoalsPayload(vTaperAnswers, GOAL_PRESETS_V1) }]);
    expect(saved).toMatchObject({
      id: NEW_GOAL_ROW_ID,
      goal: "aesthetic",
      focus: ["v_taper"],
      params_version: "keylow-training-v1",
      effective_to: null,
    });
  });

  it("should take the priorities and the version from core and never from the caller", async () => {
    const fake = installTrainingGoalsFake(server);
    const answersWithPriorities = {
      ...vTaperAnswers,
      muscle_priority: { abs: 3 },
      params_version: "caller-version",
    };

    await saveTrainingGoals(createTestClient(), answersWithPriorities);

    expect(fake.saves).toEqual([{ p_goals: trainingGoalsPayload(vTaperAnswers, GOAL_PRESETS_V1) }]);
  });

  it("should refuse answers the questionnaire would refuse, before any request, naming the field and no value", async () => {
    const fake = installTrainingGoalsFake(server);
    const invalid: GoalAnswers = {
      ...vTaperAnswers,
      days_per_week: 8,
      focus: ["v_taper", "v_taper"],
    };

    const error = await rejectionOf(saveTrainingGoals(createTestClient(), invalid));

    expect(error).toBeInstanceOf(RangeError);
    expect(error?.message).toContain("days_per_week");
    expect(error?.message).toContain("focus");
    expect(error?.message).not.toContain("8");
    expect(fake.saves).toEqual([]);
    expect(fake.reads).toEqual([]);
  });

  it("should retry once when the database refuses with a serialization failure, and resolve", async () => {
    const fake = installTrainingGoalsFake(server);
    fake.failNextSaves("40001");

    const saved = await saveTrainingGoals(createTestClient(), vTaperAnswers);

    expect(fake.saves).toHaveLength(2);
    expect(saved.id).toBe(NEW_GOAL_ROW_ID);
  });

  it("should throw after the second serialization failure, with the action and the code only", async () => {
    const fake = installTrainingGoalsFake(server);
    fake.failNextSaves("40001", "40001", "40001");

    const error = await rejectionOf(saveTrainingGoals(createTestClient(), vTaperAnswers));

    expect(fake.saves).toHaveLength(2);
    expect(error?.message).toBe("Could not save your training goals (40001)");
    expect(error?.cause).toEqual({ code: "40001" });
    expect(textOf(error)).not.toContain(RECOGNISABLE_GOAL_TEXT);
  });

  it("should retry once when a first save loses the race to another first save, which breaks the one-current-row index", async () => {
    const fake = installTrainingGoalsFake(server);
    fake.failNextSaves("23505");

    const saved = await saveTrainingGoals(createTestClient(), vTaperAnswers);

    expect(fake.saves).toHaveLength(2);
    expect(saved.id).toBe(NEW_GOAL_ROW_ID);
  });

  it("should make one retry in all, whichever of the two codes refused first", async () => {
    const fake = installTrainingGoalsFake(server);
    fake.failNextSaves("40001", "23505", "40001");

    const error = await rejectionOf(saveTrainingGoals(createTestClient(), vTaperAnswers));

    expect(fake.saves).toHaveLength(2);
    expect(error?.message).toBe("Could not save your training goals (23505)");
    expect(error?.cause).toEqual({ code: "23505" });
    expect(textOf(error)).not.toContain(RECOGNISABLE_GOAL_TEXT);
  });

  it.each(["22023", "P0002", "40P01", "42501", "23514"])(
    "should not retry a refusal with the code %s",
    async (code) => {
      const fake = installTrainingGoalsFake(server);
      fake.failNextSaves(code);

      const error = await rejectionOf(saveTrainingGoals(createTestClient(), vTaperAnswers));

      expect(fake.saves).toHaveLength(1);
      expect(error?.message).toBe(`Could not save your training goals (${code})`);
      expect(textOf(error)).not.toContain(RECOGNISABLE_GOAL_TEXT);
    },
  );

  it("should state the action and no answer when the connection is down", async () => {
    const fake = installTrainingGoalsFake(server);
    fake.goOffline();

    const error = await rejectionOf(saveTrainingGoals(createTestClient(), vTaperAnswers));

    expect(error?.message).toMatch(/^Could not save your training goals/);
    expect(textOf(error)).not.toContain("v_taper");
    expect(textOf(error)).not.toContain("aesthetic");
  });
});

describe("saveTrainingGoalsReturningId", () => {
  it("should send the payload core derives from the answers and resolve to the new row's id", async () => {
    const fake = installTrainingGoalsFake(server, { rows: [trainingGoalsRow(strengthAnswers)] });

    const id = await saveTrainingGoalsReturningId(createTestClient(), vTaperAnswers);

    expect(fake.saves).toEqual([{ p_goals: trainingGoalsPayload(vTaperAnswers, GOAL_PRESETS_V1) }]);
    expect(id).toBe(NEW_GOAL_ROW_ID);
  });

  it("should read nothing back, so no failure can come after the goal is saved", async () => {
    const fake = installTrainingGoalsFake(server);
    fake.failReadsWith("57014");

    const id = await saveTrainingGoalsReturningId(createTestClient(), vTaperAnswers);

    expect(id).toBe(NEW_GOAL_ROW_ID);
    expect(fake.reads).toEqual([]);
  });

  it("should retry once on a serialization failure, as saveTrainingGoals does", async () => {
    const fake = installTrainingGoalsFake(server);
    fake.failNextSaves("40001");

    const id = await saveTrainingGoalsReturningId(createTestClient(), vTaperAnswers);

    expect(fake.saves).toHaveLength(2);
    expect(id).toBe(NEW_GOAL_ROW_ID);
  });

  it("should state the action and the code only when the save is refused", async () => {
    const fake = installTrainingGoalsFake(server);
    fake.failNextSaves("42501");

    const error = await rejectionOf(
      saveTrainingGoalsReturningId(createTestClient(), vTaperAnswers),
    );

    expect(error?.message).toBe("Could not save your training goals (42501)");
    expect(textOf(error)).not.toContain(RECOGNISABLE_GOAL_TEXT);
  });
});

describe("closeTrainingGoals", () => {
  const current = trainingGoalsRow(vTaperAnswers);

  it("should end the current goal and resolve to true", async () => {
    const fake = installTrainingGoalsFake(server, { rows: [current] });

    const closed = await closeTrainingGoals(createTestClient(), current);

    expect(closed).toBe(true);
    expect(fake.rows[0]?.effective_to).not.toBeNull();
  });

  it("should only ask for the row with the id that has not ended", async () => {
    const fake = installTrainingGoalsFake(server, { rows: [current] });

    await closeTrainingGoals(createTestClient(), current);

    const [close] = fake.closes;
    expect(close?.query).toContain(`id=eq.${GOAL_ROW_ID}`);
    expect(close?.query).toContain("effective_to=is.null");
  });

  it("should end the goal after it started, even when this clock is behind the one that started it", async () => {
    const startedAhead = trainingGoalsRow(vTaperAnswers, {
      effective_from: new Date(Date.now() + 60_000).toISOString(),
    });
    const fake = installTrainingGoalsFake(server, { rows: [startedAhead] });

    await closeTrainingGoals(createTestClient(), startedAhead);

    const endedAt = fake.rows[0]?.effective_to ?? "";
    expect(Date.parse(endedAt)).toBeGreaterThan(Date.parse(startedAhead.effective_from));
  });

  it("should resolve to false when the goal had already ended", async () => {
    const ended = trainingGoalsRow(vTaperAnswers, { effective_to: "2026-10-11T09:00:00+00:00" });
    const fake = installTrainingGoalsFake(server, { rows: [ended] });

    const closed = await closeTrainingGoals(createTestClient(), ended);

    expect(closed).toBe(false);
    expect(fake.rows[0]?.effective_to).toBe("2026-10-11T09:00:00+00:00");
  });

  it("should state the action and the code only when the update is refused", async () => {
    const fake = installTrainingGoalsFake(server, { rows: [current] });
    fake.failClosesWith("42501");

    const error = await rejectionOf(closeTrainingGoals(createTestClient(), current));

    expect(error?.message).toBe("Could not end your training goals (42501)");
    expect(textOf(error)).not.toContain(RECOGNISABLE_GOAL_TEXT);
  });
});
