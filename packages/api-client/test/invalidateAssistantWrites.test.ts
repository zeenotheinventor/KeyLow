import { describe, expect, it } from "vitest";

import { invalidateAssistantWrites } from "../src/invalidateAssistantWrites";
import { keys } from "../src/queryKeys";
import { createQueryClient } from "./support/queryClients";

describe("invalidateAssistantWrites", () => {
  it("should mark the meal plans stale, so a new plan or a replanned day shows on the Plan screen and the Diary", async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(keys.mealPlans.list, []);
    queryClient.setQueryData(keys.mealPlans.repeatLimit, 2);

    await invalidateAssistantWrites(queryClient);

    expect(queryClient.getQueryState(keys.mealPlans.list)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(keys.mealPlans.repeatLimit)?.isInvalidated).toBe(true);
  });

  it("should still mark the diary stale", async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(keys.diary.day("2026-11-18"), []);

    await invalidateAssistantWrites(queryClient);

    expect(queryClient.getQueryState(keys.diary.day("2026-11-18"))?.isInvalidated).toBe(true);
  });
});
