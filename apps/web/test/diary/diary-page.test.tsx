import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { pagePaddingOf } from "../pagePadding";

import DiaryPage from "@/app/(dashboard)/diary/page";

vi.mock("@/components/diary", () => ({
  DiaryScreen: ({ date, view }: { date: string | undefined; view: string }) => (
    <p>{`diary for ${date ?? "today"}, ${view} view`}</p>
  ),
}));

const query = (params: Record<string, string | string[]>) => ({
  searchParams: Promise.resolve(params),
});

describe("DiaryPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("should show today's day view by default", async () => {
    render(await DiaryPage(query({})));

    expect(screen.getByText("diary for today, day view")).toBeTruthy();
  });

  it("should pass the day and the view from the address", async () => {
    render(await DiaryPage(query({ date: "2026-10-14", view: "week" })));

    expect(screen.getByText("diary for 2026-10-14, week view")).toBeTruthy();
  });

  it.each([{ date: "yesterday" }, { date: "2026-02-30" }, { date: ["2026-10-14", "2026-10-13"] }])(
    "should ignore a day that is not one real day: %j",
    async (params) => {
      render(await DiaryPage(query(params)));

      expect(screen.getByText("diary for today, day view")).toBeTruthy();
    },
  );

  it("should pad top and bottom as the web diary boards draw it", async () => {
    const { container } = render(await DiaryPage(query({})));

    expect(await pagePaddingOf(container.firstElementChild)).toEqual({
      phone: [16, 16],
      desktop: [24, 24],
    });
  });
});
