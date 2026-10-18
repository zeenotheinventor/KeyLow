import { afterAll, describe, expect, it } from "vitest";

import { adminClient } from "../support/stack";
import { createTestUser, deleteCreatedTestUsers } from "../support/users";

// What exercises_rls.test.sql cannot show, because pgTAP runs in one transaction that is rolled
// back and fires the deferred primary-muscle trigger with `set constraints` instead of a commit.
// Here every request is its own transaction and really commits. The account deletion goes through
// the auth admin API, so it commits as the auth server's own database role, which holds no
// privilege on the exercise tables, and the deferred trigger still has to pass at that commit.

afterAll(async () => {
  await deleteCreatedTestUsers();
});

const suite = "exercises";

function uniqueName(label: string): string {
  return `key347-${label}-${crypto.randomUUID()}`;
}

async function saveExercise(user: Awaited<ReturnType<typeof createTestUser>>, name: string) {
  const { data, error } = await user.client.rpc("save_exercise", {
    // PostgREST passes a JSON null for a new exercise. The generated type names the argument as a
    // string because Postgres records no nullability for function arguments.
    p_exercise_id: null as unknown as string,
    p_exercise: { name, equipment: "dumbbell", mechanic: "isolation" },
    p_muscles: [
      { muscle_id: "delt_side", role: "primary", weight: 1 },
      { muscle_id: "traps_upper", role: "secondary", weight: 0.3 },
    ],
  });
  expect(error).toBeNull();
  expect(typeof data).toBe("string");
  return data as string;
}

describe("the exercise library on a committed transaction", () => {
  it("should commit an exercise and its map saved by save_exercise", async () => {
    const user = await createTestUser(suite);
    const id = await saveExercise(user, uniqueName("saved"));

    const { data: map, error } = await user.client
      .from("exercise_muscles")
      .select("muscle_id, role, weight")
      .eq("exercise_id", id)
      .order("muscle_id");
    expect(error).toBeNull();
    expect(map).toEqual([
      { muscle_id: "delt_side", role: "primary", weight: 1 },
      { muscle_id: "traps_upper", role: "secondary", weight: 0.3 },
    ]);
  });

  it("should refuse at commit an exercise inserted with no primary muscle", async () => {
    const user = await createTestUser(suite);
    const name = uniqueName("no-map");

    const { error } = await user.client
      .from("exercises")
      .insert({
        owner_id: user.id,
        source: "user",
        name,
        equipment: "band",
        mechanic: "isolation",
      });
    expect(error?.code).toBe("23514");
    expect(error?.message).toBe("an exercise needs at least one primary muscle");

    const { data: kept } = await adminClient().from("exercises").select("id").eq("name", name);
    expect(kept).toEqual([]);
  });

  it("should refuse at commit a map change that leaves no primary muscle", async () => {
    const user = await createTestUser(suite);
    const id = await saveExercise(user, uniqueName("lose-primary"));

    const { error } = await user.client
      .from("exercise_muscles")
      .delete()
      .eq("exercise_id", id)
      .eq("role", "primary");
    expect(error?.code).toBe("23514");

    const { count } = await adminClient()
      .from("exercise_muscles")
      .select("id", { count: "exact", head: true })
      .eq("exercise_id", id)
      .eq("role", "primary");
    expect(count).toBe(1);
  });

  it("should remove the custom exercises and maps of an account deleted through the auth admin API", async () => {
    const user = await createTestUser(suite);
    const first = await saveExercise(user, uniqueName("deleted-account"));
    const second = await saveExercise(user, uniqueName("deleted-account"));

    // The helper deletes every user this file created through auth.admin.deleteUser, and throws if
    // any deletion fails. The afterAll call then has nobody left to delete.
    const deleted = await deleteCreatedTestUsers();
    expect(deleted).toContain(user.id);

    const admin = adminClient();
    const { count: exercises } = await admin
      .from("exercises")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id);
    const { count: maps } = await admin
      .from("exercise_muscles")
      .select("id", { count: "exact", head: true })
      .in("exercise_id", [first, second]);
    expect(exercises).toBe(0);
    expect(maps).toBe(0);
  });
});
