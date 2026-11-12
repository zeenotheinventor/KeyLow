import { keys } from "@keylow/api-client";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { dropStaleTargetReads } from "@/lib/dropStaleTargetReads";

describe("dropStaleTargetReads", () => {
  it("should drop the targets and every programme read, and keep the rest", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(keys.profiles.targets, { kcal: 2200 });
    queryClient.setQueryData(keys.program.all, { program: null });
    queryClient.setQueryData(keys.program.expenditureHistory(52), []);
    queryClient.setQueryData(keys.profiles.setupState, { isSetUp: true });

    dropStaleTargetReads(queryClient);

    expect(queryClient.getQueryData(keys.profiles.targets)).toBeUndefined();
    expect(queryClient.getQueryData(keys.program.all)).toBeUndefined();
    expect(queryClient.getQueryData(keys.program.expenditureHistory(52))).toBeUndefined();
    expect(queryClient.getQueryData(keys.profiles.setupState)).toEqual({ isSetUp: true });
  });
});
