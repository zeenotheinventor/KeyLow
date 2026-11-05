import {
  ADD_EXERCISE,
  FINISH_SCREEN,
  SESSION_ACTIVE,
  TRAIN_FIRST_TIME,
  TRAIN_TODAY_CARD,
} from "@keylow/core/copy";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterContext } from "next/dist/shared/lib/router-context.shared-runtime";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { lateralRaiseResults } from "./addExerciseGolden";
import { renderWithTrain, resetTrainBackend, trainBackend } from "./support";

import type { NextRouter } from "next/router";

import { DashboardNav } from "@/app/(dashboard)/DashboardNav";
import { SessionScreen, TrainRoute } from "@/components/train";
import { ToastProvider } from "@/components/ui/Toast";

// The pages are swapped by a path the router mock moves, as the browser's navigation does.
const navigation = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  return {
    path: "/dashboard",
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    go: (path: string) => {
      navigation.path = path;
      listeners.forEach((listener) => {
        listener();
      });
    },
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.path,
  useRouter: () => ({
    push: (path: string) => {
      navigation.go(path);
    },
    replace: (path: string) => {
      navigation.go(path);
    },
  }),
}));
vi.mock("@/lib/foodLogActions", () => ({
  useFoodLogActions: () => ({ openAddFood: vi.fn(), viewedDate: undefined }),
}));

function Shell() {
  const path = useSyncExternalStore(navigation.subscribe, () => navigation.path);
  // `next/link` pushes through the pages router's context under test.
  const linkRouter = {
    push: (href: string) => {
      navigation.go(href);
      return Promise.resolve(true);
    },
    replace: (href: string) => {
      navigation.go(href);
      return Promise.resolve(true);
    },
    prefetch: () => Promise.resolve(),
    // `next/link` only calls the three above.
  } as unknown as NextRouter;

  return (
    <RouterContext.Provider value={linkRouter}>
      <ToastProvider>
        <DashboardNav />
        {path === "/train" ? <TrainRoute /> : null}
        {path === "/train/session" ? <SessionScreen /> : null}
      </ToastProvider>
    </RouterContext.Provider>
  );
}

describe("logging a first session from the top bar to the saved session", () => {
  beforeEach(() => {
    resetTrainBackend();
    navigation.path = "/dashboard";
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T18:00:00Z"));
    trainBackend.searchableExercises = lateralRaiseResults;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("should take a fresh account from the Train link through Add exercise and a logged set to Save session", async () => {
    renderWithTrain(<Shell />);

    await userEvent.click(screen.getByRole("link", { name: "Train" }));
    await userEvent.click(await screen.findByRole("button", { name: TRAIN_FIRST_TIME.logAction }));

    await userEvent.click(
      await screen.findByRole("button", { name: SESSION_ACTIVE.addExerciseAction }),
    );
    const picker = screen.getByRole("dialog", { name: ADD_EXERCISE.title });
    await userEvent.type(
      within(picker).getByRole("searchbox", { name: ADD_EXERCISE.searchName }),
      "lateral raise",
    );
    await userEvent.click(
      await within(picker).findByRole("button", { name: "Add Side lateral raise" }),
    );
    const added = await screen.findByRole("region", { name: "Side lateral raise" });
    await userEvent.type(
      within(added).getByRole("textbox", { name: "Side lateral raise, set 1, kilograms" }),
      "12",
    );
    await userEvent.type(
      within(added).getByRole("textbox", { name: "Side lateral raise, set 1, reps" }),
      "15",
    );
    await userEvent.click(within(added).getByRole("button", { name: /^Log set 1/ }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Finish" })).toHaveProperty("disabled", false);
    });

    await userEvent.click(screen.getByRole("button", { name: "Finish" }));
    const dialog = await screen.findByRole("dialog", { name: "Finish session" });
    expect(within(within(dialog).getByRole("group", { name: "Sets" })).getByText("1")).toBeTruthy();
    await userEvent.click(within(dialog).getByRole("button", { name: "Save session" }));

    expect(await screen.findByText(FINISH_SCREEN.savedToast)).toBeTruthy();
    expect(trainBackend.finishedSessions).toHaveLength(1);
    expect(await screen.findByRole("heading", { level: 1, name: "Train" })).toBeTruthy();
    expect(await screen.findByText(TRAIN_TODAY_CARD.doneLabel)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Train" }).getAttribute("aria-current")).toBe("page");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
