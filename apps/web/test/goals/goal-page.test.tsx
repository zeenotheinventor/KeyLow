import { GOAL_SCREEN, GOAL_SUMMARY } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  appBackend,
  browser,
  currentAddress,
  goldenGoalRow,
  renderGoalApp,
  resetAppBackend,
  visited,
} from "./appSupport";

import type { ComponentProps } from "react";

import { resetBodyFigureForTests } from "@/lib/bodyFigure/testing";

const router = vi.hoisted(() => ({
  push: vi.fn<(href: string) => void>(),
  replace: vi.fn<(href: string) => void>(),
  back: vi.fn<() => void>(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
// A link moves the page as the app's router does, through the router mock the harness keeps the history with.
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: ComponentProps<"a"> & { href: string }) => (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        event.preventDefault();
        router.push(href);
      }}
    >
      {children}
    </a>
  ),
}));

const answerRow = (name: string) => screen.findByRole("link", { name });
const nextButton = () => screen.findByRole("button", { name: "Next" });

/** Goes from the question that is open to the summary, by Next each time. */
async function walkToTheSummary(questionsLeft: number) {
  for (let left = questionsLeft; left > 0; left -= 1) {
    await userEvent.click(await nextButton());
  }
  await userEvent.click(await screen.findByRole("button", { name: "See your priorities" }));
}

beforeEach(() => {
  resetAppBackend([goldenGoalRow]);
  resetBodyFigureForTests();
  window.localStorage.clear();
  router.push.mockReset();
  router.replace.mockReset();
  router.back.mockReset();
});

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
});

describe("the Goal page for the golden V-taper goal", () => {
  it("should list the six answers, each named for what pressing it does, and the day it was set", async () => {
    renderGoalApp(router);

    expect(await screen.findByRole("heading", { level: 1, name: GOAL_SCREEN.title })).toBeTruthy();
    for (const name of [
      "Goal: Look better. Change",
      "Focus: V-taper. Change",
      "Days a week: 4. Change",
      "Session: 60 minutes. Change",
      "Equipment: Full gym. Change",
      "Experience: Intermediate. Change",
    ]) {
      expect(await answerRow(name)).toBeTruthy();
    }
    expect(await screen.findByText("Set on Mon 21 Sep")).toBeTruthy();
    expect(screen.getByText(GOAL_SCREEN.changeNote)).toBeTruthy();
    expect(screen.getByRole("link", { name: GOAL_SCREEN.prioritiesAction })).toBeTruthy();
  });

  it("should open each answer's question from its row", async () => {
    renderGoalApp(router);

    expect((await answerRow("Days a week: 4. Change")).getAttribute("href")).toBe(
      "/goal/3?from=goal",
    );
    expect((await answerRow("Goal: Look better. Change")).getAttribute("href")).toBe(
      "/goal/1?from=goal",
    );
    expect((await answerRow("Experience: Intermediate. Change")).getAttribute("href")).toBe(
      "/goal/6?from=goal",
    );
  });

  it("should open the priorities summary from See your priorities", async () => {
    renderGoalApp(router);

    const link = await screen.findByRole("link", { name: GOAL_SCREEN.prioritiesAction });

    expect(link.getAttribute("href")).toBe("/goal/summary");
  });

  it("should take focus on its title, so a keyboard user starts at the page", async () => {
    renderGoalApp(router);

    const title = await screen.findByRole("heading", { level: 1, name: GOAL_SCREEN.title });

    expect(document.activeElement).toBe(title);
  });

  it("should go back to More from its Back button, replacing the page so that the browser's Back does not return", async () => {
    renderGoalApp(router);

    await userEvent.click(await screen.findByRole("button", { name: GOAL_SCREEN.backLabel }));

    expect(await screen.findByText("The More page")).toBeTruthy();
    expect(visited.entries).toEqual(["/more", "/more"]);
  });

  it("should go back to Train from its Back button when Train opened it", async () => {
    renderGoalApp(router, ["/train", "/goal?from=train"]);

    await userEvent.click(await screen.findByRole("button", { name: GOAL_SCREEN.backLabel }));

    expect(await screen.findByText("The Train page")).toBeTruthy();
    expect(visited.entries).toEqual(["/train", "/train"]);
  });
});

describe("changing one answer from the Goal page", () => {
  it("should save days 5 as one new row, keep the old row as history and show 5 on the page", async () => {
    renderGoalApp(router);
    await userEvent.click(await answerRow("Days a week: 4. Change"));

    // The question opens with every answer filled, so the person changes the one and walks on.
    await userEvent.click(await screen.findByRole("radio", { name: "5" }));
    await walkToTheSummary(3);
    await userEvent.click(await screen.findByRole("button", { name: GOAL_SUMMARY.saveAction }));

    expect(await answerRow("Days a week: 5. Change")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Days a week: 4. Change" })).toBeNull();
    expect(currentAddress()).toBe("/goal");
    expect(appBackend.saves).toHaveLength(1);
    expect(appBackend.rows).toHaveLength(2);
    expect(appBackend.rows.filter((row) => row.effective_to === null)).toHaveLength(1);
    expect(appBackend.rows.find((row) => row.id === goldenGoalRow.id)?.effective_to).not.toBeNull();
  });

  it("should open the question with every answer filled", async () => {
    renderGoalApp(router);

    await userEvent.click(await answerRow("Equipment: Full gym. Change"));

    expect(
      await screen.findByRole("heading", { level: 1, name: "What can you use?" }),
    ).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Barbell" }).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect((await nextButton()).hasAttribute("disabled")).toBe(false);
  });

  it("should go back to the Goal page from a question a row opened, dropping an unsaved change", async () => {
    renderGoalApp(router);
    await userEvent.click(await answerRow("Days a week: 4. Change"));
    await userEvent.click(await screen.findByRole("radio", { name: "5" }));

    await userEvent.click(await screen.findByRole("button", { name: "Back" }));

    expect(await answerRow("Days a week: 4. Change")).toBeTruthy();
    await userEvent.click(await answerRow("Days a week: 4. Change"));
    expect((await screen.findByRole("radio", { name: "4" })).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(appBackend.saves).toHaveLength(0);
  });

  it("should return to the Goal page, not to More, when the person cancels a question a row opened", async () => {
    renderGoalApp(router);
    await userEvent.click(await answerRow("Days a week: 4. Change"));

    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(await screen.findByRole("heading", { level: 1, name: GOAL_SCREEN.title })).toBeTruthy();
    expect(currentAddress()).toBe("/goal");
  });

  it("should land on the Goal page with the new answer after a save from a cold question", async () => {
    renderGoalApp(router, ["/goal/5"]);
    await userEvent.click(await screen.findByRole("checkbox", { name: "Band" }));

    await walkToTheSummary(1);
    await userEvent.click(await screen.findByRole("button", { name: GOAL_SUMMARY.saveAction }));

    expect(await screen.findByRole("heading", { level: 1, name: GOAL_SCREEN.title })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Equipment: Full gym. Change" })).toBeNull();
    expect(await screen.findByRole("link", { name: /^Equipment: .*Change$/ })).toBeTruthy();
    expect(appBackend.saves).toHaveLength(1);
  });
});

describe("Back on a question", () => {
  it("should return to the Goal page from a question a row opened, and from the next one it led to", async () => {
    renderGoalApp(router);
    await userEvent.click(await answerRow("Equipment: Full gym. Change"));
    await userEvent.click(await nextButton());
    expect(currentAddress()).toBe("/goal/6?from=goal");

    await userEvent.click(await screen.findByRole("button", { name: "Back" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "What can you use?" }),
    ).toBeTruthy();
    await userEvent.click(await screen.findByRole("button", { name: "Back" }));

    expect(await screen.findByRole("heading", { level: 1, name: GOAL_SCREEN.title })).toBeTruthy();
    expect(currentAddress()).toBe("/goal");
  });

  it("should go to the question before it, not out of the app, when a cold question is returned to after a cancel", async () => {
    renderGoalApp(router, ["/goal/4"]);
    await userEvent.click(await nextButton());
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("heading", { level: 1, name: GOAL_SCREEN.title })).toBeTruthy();

    // The browser's Back returns to the question the person left, which the Goal page was never above.
    browser.back();
    await userEvent.click(await screen.findByRole("button", { name: "Back" }));

    expect(router.back).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("heading", { level: 1, name: "How many days a week?" }),
    ).toBeTruthy();
    expect(currentAddress()).toBe("/goal/3");
  });
});

describe("starting over from the stored goal", () => {
  it("should count nothing as changed once a goal is saved: no Save goal and no dialog on cancel", async () => {
    renderGoalApp(router);
    await userEvent.click(await answerRow("Days a week: 4. Change"));
    await userEvent.click(await screen.findByRole("radio", { name: "5" }));
    await walkToTheSummary(3);
    await userEvent.click(await screen.findByRole("button", { name: GOAL_SUMMARY.saveAction }));
    await userEvent.click(await screen.findByRole("link", { name: GOAL_SCREEN.prioritiesAction }));

    expect(await screen.findByRole("heading", { level: 1, name: GOAL_SUMMARY.title })).toBeTruthy();
    expect(screen.queryByRole("button", { name: GOAL_SUMMARY.saveAction })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: GOAL_SUMMARY.backLabel }));
    await userEvent.click(await answerRow("Days a week: 5. Change"));
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(currentAddress()).toBe("/goal");
  });

  it("should start over when the stored goal changes while the page is open", async () => {
    const { queryClient } = renderGoalApp(router);
    await answerRow("Days a week: 4. Change");

    appBackend.rows = [{ ...goldenGoalRow, days_per_week: 5 }];
    await queryClient.invalidateQueries();
    await userEvent.click(await answerRow("Days a week: 5. Change"));

    expect((await screen.findByRole("radio", { name: "5" })).getAttribute("aria-checked")).toBe(
      "true",
    );
  });
});

describe("seeing the priorities from the Goal page", () => {
  it("should show the summary with no Save goal, as nothing changed, and Back returns to the page", async () => {
    renderGoalApp(router);

    await userEvent.click(await screen.findByRole("link", { name: GOAL_SCREEN.prioritiesAction }));

    expect(await screen.findByRole("heading", { level: 1, name: GOAL_SUMMARY.title })).toBeTruthy();
    expect(screen.queryByRole("button", { name: GOAL_SUMMARY.saveAction })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: GOAL_SUMMARY.backLabel }));
    expect(await screen.findByRole("heading", { level: 1, name: GOAL_SCREEN.title })).toBeTruthy();
  });
});

describe("the Goal page with no goal, or none to be read", () => {
  it("should open the first question when no goal is stored", async () => {
    resetAppBackend([]);
    renderGoalApp(router);

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/goal/1");
    });
    expect(screen.queryByRole("heading", { level: 1, name: GOAL_SCREEN.title })).toBeNull();
  });

  it("should show a named skeleton, and neither rows nor a redirect, while the goal is being read", async () => {
    appBackend.read = "pending";
    renderGoalApp(router);

    expect(await screen.findByRole("status", { name: GOAL_SCREEN.loadingName })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Change$/ })).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("should open the first question, with no skeleton for ever, when offline with nothing read", async () => {
    onlineManager.setOnline(false);
    renderGoalApp(router);

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/goal/1");
    });
    expect(screen.queryByRole("status", { name: GOAL_SCREEN.loadingName })).toBeNull();
  });
});
