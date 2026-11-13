import { KeyLowProvider, keys } from "@keylow/api-client";
import { QueryClient, useQuery } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FIRST_ACTION_ID,
  FOOD_ID,
  RECIPE_FIXTURE_ID,
  dayCopiedCard,
  foodCreatedCard,
  loggedCard,
  recipeCreatedCard,
  recipeImportCard,
  recipeUnresolvedCard,
  targetsChangedCard,
  undoUnavailableCard,
  undoneCard,
} from "../../../mobile/test/support/assistantCardFixtures";
import {
  resetUndoBackend,
  undoBackend,
  undoClient,
} from "../../../mobile/test/support/assistantUndoBackend";

import type { AssistantCard, AssistantSheetEntry } from "@keylow/core";

import { AssistantProvider, useAssistant } from "@/components/assistant";
import { CardEntry } from "@/components/assistant/CardEntry";
import { LinkEntry } from "@/components/assistant/LinkEntry";

const { push, order } = vi.hoisted(() => ({
  push: vi.fn<(href: string) => void>(),
  order: [] as string[],
}));

// The real provider, with its close noted in `order` beside the router's push.
vi.mock("@/components/assistant/AssistantProvider", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/components/assistant/AssistantProvider")>();
  return {
    ...original,
    useAssistant: () => {
      const controls = original.useAssistant();
      return {
        ...controls,
        close: () => {
          order.push("close");
          controls.close();
        },
      };
    },
  };
});

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/foodLogActions", () => ({
  useFoodLogActions: () => ({
    openAddFood: vi.fn(),
    viewedDate: "2026-10-25",
    setAssistantDescribeOpener: vi.fn(),
  }),
}));

// jsdom has no layout, so the breakpoint is whatever a test says it is.
function setWindowWidth(width: number) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: width >= 1024 && query === "(min-width: 1024px)",
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

let diaryReads = 0;

// The page beside the panel: a read under the diary's keys, as the diary screen makes.
function DiaryBesidePanel() {
  const diary = useQuery({
    queryKey: [...keys.diary.all, "probe"],
    queryFn: () => {
      diaryReads += 1;
      return Promise.resolve(diaryReads);
    },
  });
  return <p>{`Diary read ${diary.data ?? 0}`}</p>;
}

// What the panel's open state is, as a screen reader would hear it.
function PanelState() {
  const { isOpen, open } = useAssistant();
  return (
    <>
      <p role="status">{isOpen ? "Panel open" : "Panel closed"}</p>
      <button
        type="button"
        onClick={() => {
          open();
        }}
      >
        Open the panel
      </button>
    </>
  );
}

async function showCard(card: AssistantCard) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const user = userEvent.setup();
  render(
    <KeyLowProvider client={undoClient} queryClient={queryClient}>
      <AssistantProvider>
        <PanelState />
        <DiaryBesidePanel />
        <CardEntry entry={{ kind: "card", key: "card:1", card }} />
      </AssistantProvider>
    </KeyLowProvider>,
  );
  await screen.findByText("Diary read 1");
  await user.click(screen.getByRole("button", { name: "Open the panel" }));
  return user;
}

describe("the assistant card entry", () => {
  beforeEach(() => {
    resetUndoBackend();
    push.mockReset();
    push.mockImplementation(() => {
      order.push("push");
    });
    order.length = 0;
    diaryReads = 0;
    setWindowWidth(1280);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  describe("the words of each board", () => {
    it("should draw logged with its entries, its total and Undo", async () => {
      await showCard(loggedCard);

      expect(screen.getByRole("group", { name: "Logged 2 eggs and toast at 08:10" })).toBeTruthy();
      expect(screen.getByText("Egg, boiled")).toBeTruthy();
      expect(screen.getByText("2 large eggs (100 g) · 08:10")).toBeTruthy();
      expect(screen.getByText("144 kcal")).toBeTruthy();
      expect(screen.getByText("232 kcal · P 15 g · C 17 g · F 10 g")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
    });

    it("should draw day copied with the day and its total as the subtitle", async () => {
      await showCard(dayCopiedCard);

      expect(screen.getByText("Copied 8 entries from yesterday")).toBeTruthy();
      expect(screen.getByText("Saturday 24 October to today · 1,940 kcal")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
    });

    it("should draw recipe created with its subtitle and its link", async () => {
      await showCard(recipeCreatedCard);

      expect(screen.getByText("Per serving 550 kcal · P 37 g · C 79 g · F 8.6 g")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Open in recipe editor" })).toBeTruthy();
    });

    it("should draw food created with its row, note and link", async () => {
      await showCard(foodCreatedCard);

      expect(screen.getByText("Yours · 1 bar")).toBeTruthy();
      expect(
        screen.getByText("Not logged yet. Say when you had it, or log it from search."),
      ).toBeTruthy();
      expect(screen.getByRole("button", { name: "Open in your foods" })).toBeTruthy();
    });

    it("should draw targets changed with its subtitle and note", async () => {
      await showCard(targetsChangedCard);

      expect(screen.getByText("Was 2,140 kcal from your programme")).toBeTruthy();
      expect(screen.getByText(/Your programme has ended/)).toBeTruthy();
    });

    it("should draw Undone with the line under it and no action", async () => {
      await showCard(undoneCard);

      expect(screen.getByText("Undone")).toBeTruthy();
      expect(screen.getByText("Removed 2 eggs and toast from 08:10")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    });

    it("should draw Can't undo as words, with the diary note", async () => {
      await showCard(undoUnavailableCard);

      expect(screen.getByText("Can't undo")).toBeTruthy();
      expect(screen.getByText(/You changed these entries in your diary since/)).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    });

    it("should draw a sent feature request with no Undo", async () => {
      await showCard({
        ...loggedCard,
        kind: "feature_requested",
        title: "Sent a feature request",
        rows: [],
        totalText: null,
        undo: "unavailable",
      });

      expect(screen.getByRole("group", { name: "Sent a feature request" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    });

    it("should mark the imported line whose amount was guessed and no other", async () => {
      await showCard(recipeImportCard);

      expect(screen.getAllByText("Estimate")).toHaveLength(1);
    });

    it("should tick a matched line and flag an unmatched one", async () => {
      await showCard({
        ...recipeUnresolvedCard,
        rows: [
          ...recipeUnresolvedCard.rows.slice(0, 1),
          {
            name: "A splash of white wine",
            amountText: null,
            time: null,
            kcalText: null,
            match: "unresolved",
            matchedFood: "Not counted. Choose a food in the recipe editor.",
            estimate: false,
          },
        ],
      });

      expect(screen.getAllByRole("img", { name: "Matched" }).length).toBeGreaterThan(0);
      expect(screen.getByText("Not matched")).toBeTruthy();
    });
  });

  describe("Undo", () => {
    it("should send the card's action ids and turn the card into Undone", async () => {
      const user = await showCard(loggedCard);

      await user.click(screen.getByRole("button", { name: "Undo" }));

      await waitFor(() => {
        expect(screen.getByText("Undone")).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
      });
      expect(undoBackend.bodies).toHaveLength(1);
      expect(undoBackend.bodies[0]).toMatchObject({ actionIds: loggedCard.actionIds });
    });

    it("should read the diary beside the panel again as soon as the undo settles", async () => {
      const user = await showCard(loggedCard);

      await user.click(screen.getByRole("button", { name: "Undo" }));

      await screen.findByText("Diary read 2");
    });

    it("should be busy while the request is out and ignore a second press", async () => {
      let release: () => void = () => undefined;
      undoBackend.gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const user = await showCard(loggedCard);

      await user.click(screen.getByRole("button", { name: "Undo" }));
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Undo" }).getAttribute("aria-busy")).toBe("true");
      });
      await user.click(screen.getByRole("button", { name: "Undo" }));
      expect(undoBackend.bodies).toHaveLength(1);

      act(() => {
        release();
      });
      await screen.findByText("Undone");
    });

    it("should leave Undo as it was when the request fails", async () => {
      undoBackend.fails = true;
      const user = await showCard(loggedCard);

      await user.click(screen.getByRole("button", { name: "Undo" }));

      await waitFor(() => {
        expect(undoBackend.bodies).toHaveLength(1);
        expect(screen.getByRole("button", { name: "Undo" }).getAttribute("aria-busy")).toBeNull();
      });
      expect(screen.queryByText("Undone")).toBeNull();
    });

    it("should say Can't undo when the route refuses the action", async () => {
      undoBackend.codes[FIRST_ACTION_ID] = "undo_unavailable";
      const user = await showCard({ ...loggedCard, actionIds: [FIRST_ACTION_ID] });

      await user.click(screen.getByRole("button", { name: "Undo" }));

      await screen.findByText("Can't undo");
      expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    });
  });

  describe("the link", () => {
    it("should navigate the page beside the open panel and leave the panel open at 1280", async () => {
      setWindowWidth(1280);
      const user = await showCard(recipeCreatedCard);

      await user.click(screen.getByRole("button", { name: "Open in recipe editor" }));

      expect(push).toHaveBeenCalledWith(`/recipes/${RECIPE_FIXTURE_ID}/edit`);
      expect(screen.getByRole("status").textContent).toBe("Panel open");
    });

    it("should close the sheet and then navigate at 375", async () => {
      setWindowWidth(375);
      const user = await showCard(foodCreatedCard);

      await user.click(screen.getByRole("button", { name: "Open in your foods" }));

      expect(push).toHaveBeenCalledWith(`/foods/${FOOD_ID}`);
      expect(order).toEqual(["close", "push"]);
      expect(screen.getByRole("status").textContent).toBe("Panel closed");
    });

    it("should draw a plan card with its calendar icon and no link, since the web has no meal plan page", async () => {
      await showCard({
        ...recipeCreatedCard,
        kind: "plan_created",
        link: { label: "Open meal plan", target: { screen: "meal_plan", localDate: "2026-11-16" } },
      });

      expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Open meal plan" })).toBeNull();
    });

    it("should keep its link after an Undo when it opens the diary", async () => {
      const user = await showCard({
        ...dayCopiedCard,
        link: { label: "Open today", target: { screen: "diary_day", localDate: "2026-10-25" } },
      });

      await user.click(screen.getByRole("button", { name: "Undo" }));
      await screen.findByText("Undone");
      await user.click(screen.getByRole("button", { name: "Open today" }));

      expect(push).toHaveBeenCalledWith("/diary?date=2026-10-25");
    });
  });
});

describe("the assistant link entry", () => {
  beforeEach(() => {
    push.mockReset();
    push.mockImplementation(() => {
      order.push("push");
    });
    order.length = 0;
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const entry = {
    kind: "link",
    key: "link:1",
    link: {
      label: "Open in routine editor",
      target: { screen: "routine_editor", routineId: "00000000-0000-4000-8000-0000000000e2" },
    },
  } satisfies Extract<AssistantSheetEntry, { kind: "link" }>;

  function renderLink() {
    render(
      <KeyLowProvider client={undoClient} queryClient={new QueryClient()}>
        <AssistantProvider>
          <PanelState />
          <LinkEntry entry={entry} />
        </AssistantProvider>
      </KeyLowProvider>,
    );
    return userEvent.setup();
  }

  it("should draw the link row on its own and open the routine at 1280", async () => {
    setWindowWidth(1280);
    const user = renderLink();

    await user.click(screen.getByRole("button", { name: "Open in routine editor" }));

    expect(push).toHaveBeenCalledWith("/train/routines/00000000-0000-4000-8000-0000000000e2");
  });

  it("should close the sheet first at 375", async () => {
    setWindowWidth(375);
    const user = renderLink();
    await user.click(screen.getByRole("button", { name: "Open the panel" }));
    expect(screen.getByRole("status").textContent).toBe("Panel open");

    await user.click(screen.getByRole("button", { name: "Open in routine editor" }));

    expect(push).toHaveBeenCalledWith("/train/routines/00000000-0000-4000-8000-0000000000e2");
    expect(order).toEqual(["close", "push"]);
    expect(screen.getByRole("status").textContent).toBe("Panel closed");
  });
});
