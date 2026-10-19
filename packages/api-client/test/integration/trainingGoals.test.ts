import { GOAL_PRESETS_V1, deriveMusclePriority } from "@keylow/core/training";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import {
  getCurrentTrainingGoals,
  listTrainingGoalsHistory,
  saveTrainingGoals,
} from "../../src/repos/trainingGoals";
import { strengthAnswers, vTaperAnswers } from "../support/trainingGoals";

import type { TestUser } from "./support/users";

// The goal reads and the save against the local stack with real user JWTs. Each describe makes its own
// users, named key404, so the reads see exactly what the test wrote.

afterAll(async () => {
  // The users' goals go with them (on delete cascade).
  await deleteCreatedTestUsers();
});

describe("saveTrainingGoals", () => {
  let owner: TestUser;
  let stranger: TestUser;

  beforeAll(async () => {
    [owner, stranger] = await Promise.all([createTestUser("key404"), createTestUser("key404")]);
  });

  it("should store the agreed priorities and the presets version, and read them back as the current goal", async () => {
    const saved = await saveTrainingGoals(owner.client, vTaperAnswers);

    expect(saved).toMatchObject({
      user_id: owner.id,
      goal: "aesthetic",
      focus: ["v_taper"],
      days_per_week: 4,
      session_minutes: 60,
      equipment: ["barbell", "dumbbell"],
      experience: "intermediate",
      muscle_priority: deriveMusclePriority(vTaperAnswers, GOAL_PRESETS_V1),
      params_version: "keylow-training-v1",
      effective_to: null,
    });
    expect(await getCurrentTrainingGoals(owner.client)).toEqual(saved);
  });

  it("should close the first row and keep it as history when the user saves again, leaving one current row", async () => {
    const first = await getCurrentTrainingGoals(owner.client);

    const second = await saveTrainingGoals(owner.client, strengthAnswers);

    const history = await listTrainingGoalsHistory(owner.client);
    expect(history.map(({ id }) => id)).toEqual([second.id, first?.id]);
    expect(history.filter(({ effective_to }) => effective_to === null)).toHaveLength(1);
    expect(history[1]?.effective_to).not.toBeNull();
    expect(history[1]).toMatchObject({ goal: "aesthetic", focus: ["v_taper"] });
    expect(await getCurrentTrainingGoals(owner.client)).toEqual(second);
  });

  it("should never show another user's goals", async () => {
    expect(await getCurrentTrainingGoals(stranger.client)).toBeNull();
    expect(await listTrainingGoalsHistory(stranger.client)).toEqual([]);
  });

  it("should settle two saves made at once over a current row: both resolve, and only one row is current", async () => {
    const racer = await createTestUser("key404");
    await saveTrainingGoals(racer.client, vTaperAnswers);

    const [one, other] = await Promise.all([
      saveTrainingGoals(racer.client, vTaperAnswers),
      saveTrainingGoals(racer.client, strengthAnswers),
    ]);

    const history = await listTrainingGoalsHistory(racer.client);
    expect(history).toHaveLength(3);
    expect(history.filter(({ effective_to }) => effective_to === null)).toHaveLength(1);
    expect(history.map(({ id }) => id)).toEqual(expect.arrayContaining([one.id, other.id]));
  });
});
