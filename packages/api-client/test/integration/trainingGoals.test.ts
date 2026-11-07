import { GOAL_PRESETS_V1, deriveMusclePriority } from "@keylow/core/training";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import {
  closeTrainingGoals,
  getCurrentTrainingGoals,
  listTrainingGoalsHistory,
  saveTrainingGoals,
  saveTrainingGoalsReturningId,
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

describe("the assistant's Undo of a goal", () => {
  let owner: TestUser;
  let stranger: TestUser;

  beforeAll(async () => {
    [owner, stranger] = await Promise.all([createTestUser("key404"), createTestUser("key404")]);
  });

  it("should end the person's only goal at once, so they have no goal, through the granted update", async () => {
    const id = await saveTrainingGoalsReturningId(owner.client, vTaperAnswers);
    const saved = (await listTrainingGoalsHistory(owner.client)).find((row) => row.id === id);

    const closed = saved === undefined ? false : await closeTrainingGoals(owner.client, saved);

    expect(closed).toBe(true);
    expect(await getCurrentTrainingGoals(owner.client)).toBeNull();
    expect(await listTrainingGoalsHistory(owner.client)).toHaveLength(1);
  });

  it("should leave a goal that already ended as it is and say so", async () => {
    const [ended] = await listTrainingGoalsHistory(owner.client);

    const closed = ended === undefined ? true : await closeTrainingGoals(owner.client, ended);

    expect(closed).toBe(false);
  });

  it("should save the answers again as a new row that begins the instant the row before it ended", async () => {
    const firstId = await saveTrainingGoalsReturningId(owner.client, vTaperAnswers);
    const secondId = await saveTrainingGoalsReturningId(owner.client, strengthAnswers);

    const history = await listTrainingGoalsHistory(owner.client);
    const first = history.find((row) => row.id === firstId);
    const second = history.find((row) => row.id === secondId);

    expect(second?.effective_to).toBeNull();
    expect(Date.parse(first?.effective_to ?? "")).toBe(Date.parse(second?.effective_from ?? "x"));
  });

  it("should not end another person's goal", async () => {
    const theirs = await saveTrainingGoals(stranger.client, strengthAnswers);

    const closed = await closeTrainingGoals(owner.client, theirs);

    expect(closed).toBe(false);
    expect((await getCurrentTrainingGoals(stranger.client))?.id).toBe(theirs.id);
  });
});
