import { ASSISTANT_CHANGES } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AssistantChanges } from "@keylow/core";

import { AssistantChangesPage } from "@/components/assistant/AssistantChangesPage";

type UndoAnswer = { actionId: string; result: string; reason?: string }[];
type ChangesRead = {
  data: AssistantChanges | undefined;
  isError: boolean;
  fetchStatus: "idle" | "fetching" | "paused";
  refetch: () => Promise<unknown>;
};

const { router, useActiveSession, mockAssistant } = vi.hoisted(() => ({
  router: { push: vi.fn<(href: string) => void>() },
  useActiveSession: vi.fn<(options: { enabled: boolean }) => { data: object | null | undefined }>(),
  mockAssistant: {} as {
    changes: ChangesRead;
    activeSession: { data: object | null | undefined };
    undo: {
      mutateAsync: (input: { actionIds: string[] }) => Promise<UndoAnswer>;
      isPending: boolean;
    };
  },
}));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useAssistantChanges: () => mockAssistant.changes,
  useActiveSession: (options: { enabled: boolean }) => useActiveSession(options),
  useUndoAssistantAction: () => mockAssistant.undo,
}));

// The rows of `web-assistant-settings · changes`, as the hook sends them.
const changes: AssistantChanges = {
  count: 5,
  days: [
    {
      label: "Today",
      rows: [
        {
          key: "a1",
          actionIds: ["a1", "a2"],
          title: "Logged 2 eggs and toast at 08:10",
          sub: "08:11 · 2 entries",
          state: "undo",
        },
        {
          key: "a3",
          actionIds: ["a3"],
          title: "Added recipe Lemon chicken traybake",
          sub: "09:42 · 4 servings",
          state: "undo",
        },
        {
          key: "a4",
          actionIds: ["a4"],
          title: "Copied 8 entries from yesterday",
          sub: "12:30",
          state: "undone",
        },
      ],
    },
    {
      label: "Yesterday",
      rows: [
        {
          key: "a5",
          actionIds: ["a5"],
          title: "Archived recipe Pasta bake",
          sub: "19:05",
          state: "undo",
        },
        {
          key: "a6",
          actionIds: ["a6"],
          title: "Logged a flat white at 07:30",
          sub: "07:31 · changed in your diary since",
          state: "cant_undo",
        },
      ],
    },
  ],
};

// The rows of a training change, as the hook words them from the stored cards.
const training = {
  kind: "routine_updated",
  changedSinceDetail: "changed in the app since",
} as const;
const trainingChanges: AssistantChanges = {
  count: 3,
  days: [
    {
      label: "Today",
      rows: [
        {
          key: "t1",
          actionIds: ["t1"],
          title: "Updated routine Push Pull Legs",
          sub: "08:12 · 4 changes",
          state: "undo",
          training,
        },
        {
          key: "t2",
          actionIds: ["t2", "t3", "t4"],
          title: "Changed 3 sets in Legs",
          sub: "09:02 · Thu 8 Oct",
          state: "undo",
          training: { ...training, kind: "set_updated" },
        },
        {
          key: "t6",
          actionIds: ["t6"],
          title: "Archived routine Starting strength",
          sub: "18:40",
          state: "undo",
          training: { ...training, kind: "routine_archived" },
        },
      ],
    },
  ],
};

const undoButtonFor = (title: string) => screen.getByRole("button", { name: `Undo, ${title}` });
const read = (
  data: AssistantChanges | undefined,
  rest: Partial<ChangesRead> = {},
): ChangesRead => ({
  data,
  isError: false,
  fetchStatus: "idle",
  refetch: vi.fn(() => Promise.resolve()),
  ...rest,
});

describe("What the assistant changed page", () => {
  const mutateAsync = vi.fn<(input: { actionIds: string[] }) => Promise<UndoAnswer>>();

  beforeEach(() => {
    router.push.mockReset();
    mutateAsync.mockReset();
    onlineManager.setOnline(true);
    mockAssistant.changes = read(changes);
    mockAssistant.activeSession = { data: null };
    useActiveSession.mockReset();
    useActiveSession.mockImplementation(() => mockAssistant.activeSession);
    mockAssistant.undo = { mutateAsync, isPending: false };
  });

  afterEach(() => {
    cleanup();
    onlineManager.setOnline(true);
  });

  describe("the frame", () => {
    it("should be headed What the assistant changed, with a way back to the Assistant settings", async () => {
      render(<AssistantChangesPage />);

      expect(screen.getByRole("heading", { level: 1, name: ASSISTANT_CHANGES.title })).toBeTruthy();
      await userEvent.click(screen.getByRole("button", { name: ASSISTANT_CHANGES.back }));
      expect(router.push).toHaveBeenCalledExactlyOnceWith("/more/assistant");
    });
  });

  describe("the list", () => {
    it("should group the rows by day, in the order the hook sends them", () => {
      render(<AssistantChangesPage />);

      expect(screen.getAllByRole("region")).toHaveLength(2);
      expect(
        screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
      ).toEqual(["Today", "Yesterday"]);
    });

    it("should draw every row's title and sub line as sent, under its day", () => {
      render(<AssistantChangesPage />);

      const today = within(screen.getByRole("region", { name: "Today" }));
      const yesterday = within(screen.getByRole("region", { name: "Yesterday" }));

      expect(today.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
        "Logged 2 eggs and toast at 08:1008:11 · 2 entriesUndo",
        "Added recipe Lemon chicken traybake09:42 · 4 servingsUndo",
        "Copied 8 entries from yesterday12:30Undone",
      ]);
      expect(yesterday.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
        "Archived recipe Pasta bake19:05Undo",
        "Logged a flat white at 07:3007:31 · changed in your diary sinceCan't undo",
      ]);
    });

    it("should offer Undo on the three rows that can be undone and no other action", () => {
      render(<AssistantChangesPage />);

      expect(screen.getAllByRole("button", { name: /^Undo, / })).toHaveLength(3);
      expect(screen.getAllByRole("button")).toHaveLength(4);
    });

    it("should say Undone and Can't undo as plain words, with no button", () => {
      render(<AssistantChangesPage />);

      expect(screen.getByText("Undone")).toBeTruthy();
      expect(screen.getByText("Can't undo")).toBeTruthy();
      expect(screen.queryByRole("button", { name: /^Undone/ })).toBeNull();
      expect(screen.queryByRole("button", { name: /^Can't undo/ })).toBeNull();
    });

    it("should mute the title of an undone row only", () => {
      render(<AssistantChangesPage />);

      expect(screen.getByText("Copied 8 entries from yesterday").className).toContain(
        "text-text-secondary",
      );
      expect(screen.getByText("Logged a flat white at 07:30").className).not.toContain(
        "text-text-secondary",
      );
    });

    it("should end with the footer about when Undo works", () => {
      render(<AssistantChangesPage />);

      expect(screen.getByText(ASSISTANT_CHANGES.footer)).toBeTruthy();
    });

    it("should draw no empty state", () => {
      render(<AssistantChangesPage />);

      expect(screen.queryByText(ASSISTANT_CHANGES.emptyTitle)).toBeNull();
    });
  });

  describe("Undo", () => {
    it("should send that row's action ids once, and then read Undone with no button", async () => {
      mutateAsync.mockResolvedValue([
        { actionId: "a1", result: "undone" },
        { actionId: "a2", result: "undone" },
      ]);
      render(<AssistantChangesPage />);

      await userEvent.click(undoButtonFor("Logged 2 eggs and toast at 08:10"));

      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: "Undo, Logged 2 eggs and toast at 08:10" }),
        ).toBeNull();
      });
      expect(mutateAsync).toHaveBeenCalledExactlyOnceWith({ actionIds: ["a1", "a2"] });
      const row = screen.getByText("Logged 2 eggs and toast at 08:10").closest("li");
      expect(row?.textContent).toBe("Logged 2 eggs and toast at 08:1008:11 · 2 entriesUndone");
    });

    it("should leave the other rows as they were", async () => {
      mutateAsync.mockResolvedValue([{ actionId: "a3", result: "undone" }]);
      render(<AssistantChangesPage />);

      await userEvent.click(undoButtonFor("Added recipe Lemon chicken traybake"));

      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: "Undo, Added recipe Lemon chicken traybake" }),
        ).toBeNull();
      });
      expect(undoButtonFor("Logged 2 eggs and toast at 08:10")).toBeTruthy();
      expect(undoButtonFor("Archived recipe Pasta bake")).toBeTruthy();
    });

    it("should read Can't undo when the entries were changed since", async () => {
      mutateAsync.mockResolvedValue([{ actionId: "a5", result: "undo_unavailable" }]);
      render(<AssistantChangesPage />);

      await userEvent.click(undoButtonFor("Archived recipe Pasta bake"));

      await waitFor(() => {
        expect(screen.getByText("Archived recipe Pasta bake").closest("li")?.textContent).toBe(
          "Archived recipe Pasta bake19:05Can't undo",
        );
      });
    });

    it("should read Undone when someone got there first", async () => {
      mutateAsync.mockResolvedValue([{ actionId: "a5", result: "already_undone" }]);
      render(<AssistantChangesPage />);

      await userEvent.click(undoButtonFor("Archived recipe Pasta bake"));

      await waitFor(() => {
        expect(screen.getByText("Archived recipe Pasta bake").closest("li")?.textContent).toBe(
          "Archived recipe Pasta bake19:05Undone",
        );
      });
    });

    it("should keep Undo when the request fails, because nothing was undone that the row knows of", async () => {
      mutateAsync.mockRejectedValue(new Error("offline"));
      render(<AssistantChangesPage />);

      await userEvent.click(undoButtonFor("Archived recipe Pasta bake"));

      await waitFor(() => {
        expect(mutateAsync).toHaveBeenCalledTimes(1);
      });
      expect(undoButtonFor("Archived recipe Pasta bake").getAttribute("aria-busy")).toBeNull();
    });

    it("should be busy and send nothing more while an undo is running", async () => {
      mockAssistant.undo = { mutateAsync, isPending: true };
      render(<AssistantChangesPage />);

      const button = undoButtonFor("Archived recipe Pasta bake");
      await userEvent.click(button);

      expect(button.getAttribute("aria-busy")).toBe("true");
      expect(mutateAsync).not.toHaveBeenCalled();
    });
  });

  describe("the active session read", () => {
    it("should not be made when no row is a training row", () => {
      render(<AssistantChangesPage />);

      expect(useActiveSession).toHaveBeenCalledWith({ enabled: false });
      expect(useActiveSession).not.toHaveBeenCalledWith({ enabled: true });
    });

    it("should be made when a row is a training row", () => {
      mockAssistant.changes = read(trainingChanges);
      render(<AssistantChangesPage />);

      expect(useActiveSession).toHaveBeenCalledWith({ enabled: true });
    });
  });

  describe("a training change", () => {
    beforeEach(() => {
      mockAssistant.changes = read(trainingChanges);
    });

    it("should draw each training row's title and sub as sent, with Undo", () => {
      render(<AssistantChangesPage />);

      expect(screen.getByText("Updated routine Push Pull Legs")).toBeTruthy();
      expect(screen.getByText("08:12 · 4 changes")).toBeTruthy();
      expect(screen.getByText("09:02 · Thu 8 Oct")).toBeTruthy();
      expect(screen.getAllByRole("button", { name: /^Undo, / })).toHaveLength(3);
    });

    it("should say Can't undo yet with no button on every training row while a workout is in progress", () => {
      mockAssistant.activeSession = { data: { id: "session-1" } };
      render(<AssistantChangesPage />);

      expect(screen.getAllByText("Can't undo yet")).toHaveLength(3);
      expect(screen.queryByRole("button", { name: /^Undo, / })).toBeNull();
    });

    it("should leave a food row's Undo as it was while a workout is in progress", () => {
      mockAssistant.activeSession = { data: { id: "session-1" } };
      mockAssistant.changes = read({
        count: 2,
        days: [
          {
            label: "Today",
            rows: [
              ...(changes.days[0]?.rows.slice(0, 1) ?? []),
              ...(trainingChanges.days[0]?.rows.slice(0, 1) ?? []),
            ],
          },
        ],
      });
      render(<AssistantChangesPage />);

      expect(undoButtonFor("Logged 2 eggs and toast at 08:10")).toBeTruthy();
      expect(screen.getAllByText("Can't undo yet")).toHaveLength(1);
    });

    it("should read Can't undo with changed in the app since when the press says the routine changed", async () => {
      mutateAsync.mockResolvedValue([
        { actionId: "t6", result: "undo_unavailable", reason: "changed" },
      ]);
      render(<AssistantChangesPage />);

      await userEvent.click(undoButtonFor("Archived routine Starting strength"));

      await waitFor(() => {
        expect(
          screen.getByText("Archived routine Starting strength").closest("li")?.textContent,
        ).toBe("Archived routine Starting strength18:40 · changed in the app sinceCan't undo");
      });
    });

    it("should say what was put back when only some of three sets were", async () => {
      mutateAsync.mockResolvedValue([
        { actionId: "t2", result: "undone" },
        { actionId: "t3", result: "undone" },
        { actionId: "t4", result: "undo_unavailable", reason: "changed" },
      ]);
      render(<AssistantChangesPage />);

      await userEvent.click(undoButtonFor("Changed 3 sets in Legs"));

      await waitFor(() => {
        expect(screen.getByText("Changed 3 sets in Legs").closest("li")?.textContent).toBe(
          "Changed 3 sets in Legs09:02 · Put back 2 of 3 setsCan't undo",
        );
      });
    });

    it("should wait while the workout lasts after a refused press, and offer Undo again once it ends", async () => {
      mutateAsync.mockResolvedValue([
        { actionId: "t1", result: "undo_unavailable", reason: "workout_in_progress" },
      ]);
      const view = render(<AssistantChangesPage />);

      await userEvent.click(undoButtonFor("Updated routine Push Pull Legs"));
      await waitFor(() => {
        expect(mutateAsync).toHaveBeenCalledTimes(1);
      });
      mockAssistant.activeSession = { data: { id: "session-1" } };
      view.rerender(<AssistantChangesPage />);

      expect(
        screen.getByText("Updated routine Push Pull Legs").closest("li")?.textContent,
      ).toContain("Can't undo yet");

      mockAssistant.activeSession = { data: null };
      view.rerender(<AssistantChangesPage />);

      expect(undoButtonFor("Updated routine Push Pull Legs")).toBeTruthy();
    });
  });

  describe("nothing changed yet", () => {
    beforeEach(() => {
      mockAssistant.changes = read({ days: [], count: 0 });
    });

    it("should say so in the board's words, under the title", () => {
      render(<AssistantChangesPage />);

      expect(
        screen.getByRole("heading", { level: 2, name: ASSISTANT_CHANGES.emptyTitle }),
      ).toBeTruthy();
      expect(screen.getByText(ASSISTANT_CHANGES.emptyBody)).toBeTruthy();
      expect(screen.getByRole("heading", { level: 1, name: ASSISTANT_CHANGES.title })).toBeTruthy();
    });

    it("should draw no footer and no Undo", () => {
      render(<AssistantChangesPage />);

      expect(screen.queryByText(ASSISTANT_CHANGES.footer)).toBeNull();
      expect(screen.queryByRole("button", { name: /^Undo/ })).toBeNull();
    });
  });

  describe("before the list is read", () => {
    it("should draw the title and a Loading status, with neither the list nor the empty state", () => {
      mockAssistant.changes = read(undefined, { fetchStatus: "fetching" });
      render(<AssistantChangesPage />);

      expect(screen.getByRole("heading", { level: 1, name: ASSISTANT_CHANGES.title })).toBeTruthy();
      expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy();
      expect(screen.queryByText(ASSISTANT_CHANGES.emptyTitle)).toBeNull();
      expect(screen.queryByText(ASSISTANT_CHANGES.footer)).toBeNull();
    });

    it("should say it failed with Try again, which reads again, when the first read failed", async () => {
      const refetch = vi.fn(() => Promise.resolve());
      mockAssistant.changes = read(undefined, { isError: true, refetch });
      render(<AssistantChangesPage />);

      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.queryByRole("status", { name: "Loading" })).toBeNull();
      await userEvent.click(screen.getByRole("button", { name: "Try again" }));
      expect(refetch).toHaveBeenCalledTimes(1);
    });

    it("should say it could not load, with no Try again and no endless skeleton, when offline with nothing read", () => {
      act(() => {
        onlineManager.setOnline(false);
      });
      mockAssistant.changes = read(undefined, { fetchStatus: "paused" });
      render(<AssistantChangesPage />);

      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
      expect(screen.queryByRole("status", { name: "Loading" })).toBeNull();
    });

    it("should keep the list when a later read failed, since only a list that never loaded is the error", () => {
      mockAssistant.changes = read(changes, { isError: true });
      render(<AssistantChangesPage />);

      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.getAllByRole("button", { name: /^Undo, / })).toHaveLength(3);
    });
  });
});
