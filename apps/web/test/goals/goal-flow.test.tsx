import { onlineManager } from "@tanstack/react-query";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { goalsBackend, renderGoalFlow, resetGoalsBackend, storedGoalRow } from "./support";

const router = vi.hoisted(() => ({
  push: vi.fn<(href: string) => void>(),
  replace: vi.fn<(href: string) => void>(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  notFound: () => {
    throw new Error("not found");
  },
}));

const isChecked = (element: HTMLElement) => element.getAttribute("aria-checked") === "true";
// The dialog's icon button and the button in its footer share the name Keep answering, as they do the same.
// The icon button comes first.
function keepAnsweringButton(position: "icon" | "footer"): HTMLElement {
  const [icon, footer] = screen.getAllByRole("button", { name: "Keep answering" });
  const button = position === "icon" ? icon : footer;
  if (button === undefined) {
    throw new Error("The dialog has no such button");
  }
  return button;
}
const nextButton = () => screen.findByRole<HTMLButtonElement>("button", { name: "Next" });

beforeEach(() => {
  resetGoalsBackend();
  router.push.mockReset();
  router.replace.mockReset();
});

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
});

describe("the goal questionnaire's first question", () => {
  it("should ask what the person is training for, with Next waiting for an answer", async () => {
    renderGoalFlow(router);

    expect(
      await screen.findByRole("heading", { level: 1, name: "What are you training for?" }),
    ).toBeTruthy();
    expect((await nextButton()).disabled).toBe(true);
    for (const card of screen.getAllByRole("radio")) {
      expect(isChecked(card)).toBe(false);
    }
  });

  it("should enable Next once a goal is chosen, and go to the second question with it", async () => {
    renderGoalFlow(router);

    await userEvent.click(await screen.findByRole("radio", { name: /^Get stronger/ }));

    const next = await nextButton();
    expect(next.disabled).toBe(false);
    await userEvent.click(next);
    expect(router.push).toHaveBeenCalledWith("/goal/2");
  });

  it("should have no Back, as nothing comes before it", async () => {
    renderGoalFlow(router);

    await screen.findByRole("heading", { level: 1 });

    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });

  it("should move focus to the question's title", async () => {
    renderGoalFlow(router);

    const title = await screen.findByRole("heading", { level: 1 });

    expect(document.activeElement).toBe(title);
  });

  it("should say which question it is, and how far through", async () => {
    renderGoalFlow(router);

    expect(await screen.findByText("Your goal · 1 of 6")).toBeTruthy();
    const progress = screen.getByRole("progressbar", { name: "Questions answered" });
    expect(progress.getAttribute("aria-valuenow")).toBe("1");
    expect(progress.getAttribute("aria-valuemax")).toBe("6");
  });
});

describe("the second and third questions", () => {
  it("should let Next through on the focus with none chosen, since none is an answer", async () => {
    goalsBackend.row = null;
    renderGoalFlow(router);
    await userEvent.click(await screen.findByRole("radio", { name: /^Both/ }));
    await userEvent.click(await nextButton());

    // The router mock moves the page to the second question, which asks for the focus.
    expect(
      await screen.findByRole("heading", { level: 1, name: "Anything to focus on?" }),
    ).toBeTruthy();
    expect((await nextButton()).disabled).toBe(false);
    expect(screen.getByText("Your goal · 2 of 6")).toBeTruthy();
  });

  it("should offer any number of focuses as checkboxes", async () => {
    renderGoalFlow(router);
    await userEvent.click(await screen.findByRole("radio", { name: /^Both/ }));
    await userEvent.click(await nextButton());

    await userEvent.click(await screen.findByRole("checkbox", { name: /^Chest/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /^Arms/ }));

    expect(isChecked(screen.getByRole("checkbox", { name: /^Chest/ }))).toBe(true);
    expect(isChecked(screen.getByRole("checkbox", { name: /^Arms/ }))).toBe(true);
    expect(isChecked(screen.getByRole("checkbox", { name: /^Legs/ }))).toBe(false);
  });

  it("should keep Next off the days question until a day count is chosen", async () => {
    renderGoalFlow(router);
    await userEvent.click(await screen.findByRole("radio", { name: /^Both/ }));
    await userEvent.click(await nextButton());
    await userEvent.click(await nextButton());

    expect(
      await screen.findByRole("heading", { level: 1, name: "How many days a week?" }),
    ).toBeTruthy();
    expect((await nextButton()).disabled).toBe(true);

    await userEvent.click(screen.getByRole("radio", { name: "4" }));

    expect((await nextButton()).disabled).toBe(false);
    expect(screen.getAllByRole("radio").map((chip) => [chip.textContent, isChecked(chip)])).toEqual(
      [
        ["1", false],
        ["2", false],
        ["3", false],
        ["4", true],
        ["5", false],
        ["6", false],
        ["7", false],
      ],
    );
  });

  it("should go on to the fourth question from the days", async () => {
    goalsBackend.row = storedGoalRow;
    renderGoalFlow(router, "/goal/3");

    await userEvent.click(await nextButton());

    expect(router.push).toHaveBeenCalledWith("/goal/4");
  });
});

describe("Back", () => {
  it("should keep the answers of the questions it returns to", async () => {
    renderGoalFlow(router);
    await userEvent.click(await screen.findByRole("radio", { name: /^Get stronger/ }));
    await userEvent.click(await nextButton());
    await userEvent.click(await screen.findByRole("checkbox", { name: /^Legs/ }));

    await userEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(router.push).toHaveBeenLastCalledWith("/goal/1");
    expect(isChecked(await screen.findByRole("radio", { name: /^Get stronger/ }))).toBe(true);

    await userEvent.click(await nextButton());
    expect(isChecked(await screen.findByRole("checkbox", { name: /^Legs/ }))).toBe(true);
  });
});

describe("Back from the days", () => {
  it("should return to the focus question", async () => {
    goalsBackend.row = storedGoalRow;
    renderGoalFlow(router, "/goal/3");

    await userEvent.click(await screen.findByRole("button", { name: "Back" }));

    expect(router.push).toHaveBeenCalledWith("/goal/2");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Anything to focus on?" }),
    ).toBeTruthy();
  });
});

describe("closing the questionnaire", () => {
  it("should leave for More at once when nothing was answered", async () => {
    renderGoalFlow(router);

    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(router.replace).toHaveBeenCalledWith("/more");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("should ask first when there are answers, with focus on Keep answering, and stay on the question if the person keeps answering", async () => {
    renderGoalFlow(router);
    await userEvent.click(await screen.findByRole("radio", { name: /^Both/ }));

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("dialog", { name: "Your answers are not saved" })).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(keepAnsweringButton("footer"));

    await userEvent.click(keepAnsweringButton("footer"));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(isChecked(screen.getByRole("radio", { name: /^Both/ }))).toBe(true);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("should keep answering from the dialog's icon button too", async () => {
    renderGoalFlow(router);
    await userEvent.click(await screen.findByRole("radio", { name: /^Both/ }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await userEvent.click(keepAnsweringButton("icon"));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("should leave for More when the person closes it anyway", async () => {
    renderGoalFlow(router);
    await userEvent.click(await screen.findByRole("radio", { name: /^Both/ }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    const dialog = screen.getByRole("dialog", { name: "Your answers are not saved" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));

    expect(router.replace).toHaveBeenCalledWith("/more");
  });

  it("should not ask when the answers are only the goal that was stored, and leave for the Goal page", async () => {
    goalsBackend.row = storedGoalRow;
    renderGoalFlow(router);

    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(router.replace).toHaveBeenCalledWith("/goal");
  });

  it("should ask when an answer was changed from the stored goal", async () => {
    goalsBackend.row = storedGoalRow;
    renderGoalFlow(router);
    await userEvent.click(await screen.findByRole("radio", { name: /^Get stronger/ }));

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("dialog", { name: "Your answers are not saved" })).toBeTruthy();
  });
});

describe("a goal that is stored", () => {
  beforeEach(() => {
    goalsBackend.row = storedGoalRow;
  });

  it("should fill the goal question", async () => {
    renderGoalFlow(router);

    expect(isChecked(await screen.findByRole("radio", { name: /^Both/ }))).toBe(true);
  });

  it("should fill the focus question", async () => {
    renderGoalFlow(router, "/goal/2");

    expect(isChecked(await screen.findByRole("checkbox", { name: /^Arms/ }))).toBe(true);
    expect(isChecked(screen.getByRole("checkbox", { name: /^Chest/ }))).toBe(true);
    expect(isChecked(screen.getByRole("checkbox", { name: /^Legs/ }))).toBe(false);
  });

  it("should fill the days question", async () => {
    renderGoalFlow(router, "/goal/3");

    expect(isChecked(await screen.findByRole("radio", { name: "5" }))).toBe(true);
  });
});

describe("while the goal is read", () => {
  it("should draw no question yet, so a goal is not shown empty and then filled", async () => {
    goalsBackend.status = "pending";

    renderGoalFlow(router);

    await waitFor(() => {
      expect(goalsBackend.reads).toBe(1);
    });
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("should open the questions empty when the goal cannot be read", async () => {
    goalsBackend.status = "error";

    renderGoalFlow(router);

    expect(
      await screen.findByRole("heading", { level: 1, name: "What are you training for?" }),
    ).toBeTruthy();
    for (const card of screen.getAllByRole("radio")) {
      expect(isChecked(card)).toBe(false);
    }
  });

  it("should open the first question empty, and never wait, when offline with nothing stored", async () => {
    onlineManager.setOnline(false);

    renderGoalFlow(router);

    expect(
      await screen.findByRole("heading", { level: 1, name: "What are you training for?" }),
    ).toBeTruthy();
    for (const card of screen.getAllByRole("radio")) {
      expect(isChecked(card)).toBe(false);
    }
  });
});

describe("a question reached out of order", () => {
  it("should send the person to the first question when an earlier one is open", async () => {
    renderGoalFlow(router, "/goal/3");

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/goal/1");
    });
    expect(screen.queryByRole("heading", { level: 1, name: "How many days a week?" })).toBeNull();
  });

  it("should send the person to the days when the goal is answered and the days are not", async () => {
    renderGoalFlow(router);
    await userEvent.click(await screen.findByRole("radio", { name: /^Both/ }));

    router.push.mockClear();
    router.replace.mockClear();
    await userEvent.click(await nextButton());
    await userEvent.click(await nextButton());
    await screen.findByRole("heading", { level: 1, name: "How many days a week?" });

    expect(router.replace).not.toHaveBeenCalled();
  });

  it.each(["0", "7", "summary", "two"])(
    "should send an address of %s to the first question",
    async (segment) => {
      renderGoalFlow(router, `/goal/${segment}`);

      await waitFor(() => {
        expect(router.replace).toHaveBeenCalledWith("/goal/1");
      });
    },
  );
});
