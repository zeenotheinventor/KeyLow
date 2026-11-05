import { describe, expect, it, vi } from "vitest";

import GoalPage from "@/app/(dashboard)/goal/page";

const redirect = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ redirect }));

describe("the goal questionnaire's own address", () => {
  it("should open the first question", () => {
    GoalPage();

    expect(redirect).toHaveBeenCalledWith("/goal/1");
  });
});
