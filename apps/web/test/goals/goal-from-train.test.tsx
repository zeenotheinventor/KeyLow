import { GOAL_SCREEN, GOAL_SUMMARY } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  appBackend,
  currentAddress,
  goldenGoalRow,
  renderGoalApp,
  resetAppBackend,
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
const nextButton = () => screen.findByRole("button", { name: /^(Next|See your priorities)$/ });

const FIRST_ANSWERS: readonly (readonly [role: "radio" | "checkbox", name: string | RegExp])[] = [
  ["radio", /^Get stronger/],
  ["checkbox", /^V-taper/],
  ["radio", "4"],
  ["radio", "60 min"],
  ["checkbox", "Full gym"],
  ["radio", /^Intermediate/],
];

/** Answers the question that is open, the one that is `question`th, and walks on with Next. */
async function answerAndGoOn(question: number) {
  const answer = FIRST_ANSWERS[question - 1];
  if (answer === undefined) {
    throw new Error("The flow has no such question");
  }
  await userEvent.click(await screen.findByRole(answer[0], { name: answer[1] }));
  await userEvent.click(await nextButton());
}

beforeEach(() => {
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

describe("the goal flow Train opens, with no goal stored", () => {
  beforeEach(() => {
    resetAppBackend([]);
  });

  it("should carry Train as the origin from the Goal page to the first question", async () => {
    renderGoalApp(router, ["/train", "/goal?from=train"]);

    expect(
      await screen.findByRole("heading", { level: 1, name: "What are you training for?" }),
    ).toBeTruthy();
    expect(currentAddress()).toBe("/goal/1?origin=train");
  });

  it("should return to Train when Cancel is pressed with nothing answered", async () => {
    renderGoalApp(router, ["/train", "/goal/1?origin=train"]);

    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(await screen.findByText("The Train page")).toBeTruthy();
  });

  it("should return to Train when Cancel is confirmed with answers given", async () => {
    renderGoalApp(router, ["/train", "/goal/1?origin=train"]);
    await userEvent.click(await screen.findByRole("radio", { name: /^Get stronger/ }));
    await userEvent.click(await nextButton());

    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await userEvent.click(await screen.findByRole("button", { name: "Close" }));

    expect(await screen.findByText("The Train page")).toBeTruthy();
  });

  it("should keep Train as the origin through every question to the summary, and return to Train after Save goal", async () => {
    renderGoalApp(router, ["/train", "/goal/1?origin=train"]);

    for (let question = 1; question <= 6; question += 1) {
      expect(currentAddress()).toBe(`/goal/${question}?origin=train`);
      await answerAndGoOn(question);
    }
    expect(await screen.findByRole("heading", { name: GOAL_SUMMARY.title })).toBeTruthy();
    expect(currentAddress()).toBe("/goal/summary?origin=train");
    await userEvent.click(await screen.findByRole("button", { name: GOAL_SUMMARY.saveAction }));

    expect(await screen.findByText("The Train page")).toBeTruthy();
    expect(appBackend.saves).toHaveLength(1);
  }, 20_000);

  it("should keep Train as the origin when Back goes to the question before", async () => {
    renderGoalApp(router, ["/train", "/goal/1?origin=train"]);
    await answerAndGoOn(1);

    await userEvent.click(await screen.findByRole("button", { name: "Back" }));

    expect(currentAddress()).toBe("/goal/1?origin=train");
  });

  it("should keep Train as the origin when the summary reached too early sends the person back, and Cancel then returns to Train", async () => {
    renderGoalApp(router, ["/train", "/goal/summary?origin=train"]);

    expect(
      await screen.findByRole("heading", { level: 1, name: "What are you training for?" }),
    ).toBeTruthy();
    expect(currentAddress()).toBe("/goal/1?origin=train");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText("The Train page")).toBeTruthy();
  });

  it("should keep Train as the origin when a question reached too early sends the person back", async () => {
    renderGoalApp(router, ["/train", "/goal/4?origin=train"]);

    expect(
      await screen.findByRole("heading", { level: 1, name: "What are you training for?" }),
    ).toBeTruthy();
    expect(currentAddress()).toBe("/goal/1?origin=train");
  });
});

describe("the goal flow Train opens, with a goal stored", () => {
  beforeEach(() => {
    resetAppBackend([goldenGoalRow]);
  });

  it("should carry Train as the origin on a row's question and on the summary it leads to", async () => {
    renderGoalApp(router, ["/train", "/goal?from=train"]);

    await userEvent.click(await answerRow("Days a week: 4. Change"));
    expect(currentAddress()).toBe("/goal/3?from=goal&origin=train");
    await userEvent.click(await nextButton());
    expect(currentAddress()).toBe("/goal/4?from=goal&origin=train");

    await userEvent.click(await screen.findByRole("button", { name: "Back" }));
    await userEvent.click(await screen.findByRole("button", { name: "Back" }));
    await userEvent.click(await screen.findByRole("link", { name: GOAL_SCREEN.prioritiesAction }));
    expect(currentAddress()).toBe("/goal/summary?origin=train");
  });

  it("should return to Train from Back on the Goal page after a row is changed and saved", async () => {
    renderGoalApp(router, ["/train", "/goal?from=train"]);
    await userEvent.click(await answerRow("Days a week: 4. Change"));
    await userEvent.click(await screen.findByRole("radio", { name: "5" }));
    for (let left = 4; left > 0; left -= 1) {
      await userEvent.click(await nextButton());
    }
    await userEvent.click(await screen.findByRole("button", { name: GOAL_SUMMARY.saveAction }));

    expect(await answerRow("Days a week: 5. Change")).toBeTruthy();
    expect(currentAddress()).toBe("/goal?from=train");
    await userEvent.click(screen.getByRole("button", { name: GOAL_SCREEN.backLabel }));

    expect(await screen.findByText("The Train page")).toBeTruthy();
  });

  it("should keep the Goal page's Back for Train after a cancel from a row's question", async () => {
    renderGoalApp(router, ["/train", "/goal?from=train"]);
    await userEvent.click(await answerRow("Days a week: 4. Change"));

    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(currentAddress()).toBe("/goal?from=train");
    await userEvent.click(await screen.findByRole("button", { name: GOAL_SCREEN.backLabel }));
    expect(await screen.findByText("The Train page")).toBeTruthy();
  });

  it("should say nothing of Train when More opened the Goal page", async () => {
    renderGoalApp(router, ["/more", "/goal"]);
    await userEvent.click(await answerRow("Days a week: 4. Change"));
    expect(currentAddress()).toBe("/goal/3?from=goal");

    await userEvent.click(await screen.findByRole("radio", { name: "5" }));
    for (let left = 4; left > 0; left -= 1) {
      await userEvent.click(await nextButton());
    }
    expect(currentAddress()).toBe("/goal/summary");
    await userEvent.click(await screen.findByRole("button", { name: GOAL_SUMMARY.saveAction }));

    expect(await answerRow("Days a week: 5. Change")).toBeTruthy();
    expect(currentAddress()).toBe("/goal");
    await userEvent.click(screen.getByRole("button", { name: GOAL_SCREEN.backLabel }));
    expect(await screen.findByText("The More page")).toBeTruthy();
  });
});

describe("the goal flow More opens, with no goal stored", () => {
  it("should return to More when Cancel is pressed and keep no origin in the addresses", async () => {
    resetAppBackend([]);
    renderGoalApp(router, ["/more", "/goal"]);

    expect(await screen.findByRole("button", { name: "Next" })).toBeTruthy();
    expect(currentAddress()).toBe("/goal/1");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText("The More page")).toBeTruthy();
  });
});
