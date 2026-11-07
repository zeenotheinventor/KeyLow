import { controlHeight, touchTarget } from "@keylow/tokens";
import { render, screen, userEvent, within } from "@testing-library/react-native";

import AssistantChangesRoute from "../app/(tabs)/more/assistant/changes";
import { ThemeProvider } from "../lib/theme";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { resolvedColor } from "./support/themeColor";

import type { AssistantChanges } from "@keylow/core";

type UndoAnswer = { actionId: string; result: string; reason?: string }[];

// What the two assistant hooks answer. The hooks are tested where they live, in `@keylow/api-client`.
const mockAssistant: {
  changes: { data: AssistantChanges | undefined };
  activeSession: { data: object | null | undefined };
  undo: {
    mutateAsync: jest.Mock<Promise<UndoAnswer>, [{ actionIds: string[] }]>;
    isPending: boolean;
  };
} = {
  changes: { data: undefined },
  activeSession: { data: null },
  undo: {
    mutateAsync: jest.fn<Promise<UndoAnswer>, [{ actionIds: string[] }]>(),
    isPending: false,
  },
};

jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useAssistantChanges: () => mockAssistant.changes,
  useActiveSession: () => mockAssistant.activeSession,
  useUndoAssistantAction: () => mockAssistant.undo,
}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

// The rows of `assistant-settings · changes`, which the hook sends as these words.
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

const FOOTER =
  "Undo works while an item is as the assistant left it. Once you change it in the diary, the recipe editor or Train, change it there. Undo on training waits while a workout is in progress.";

async function renderChanges() {
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <AssistantChangesRoute />
    </ThemeProvider>,
  );
  return user;
}

const undoButtonFor = (title: string) => screen.getByRole("button", { name: `Undo, ${title}` });

describe("the What the assistant changed screen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/AssistantChangesScreen"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    mockAssistant.changes = { data: changes };
    mockAssistant.activeSession = { data: null };
    mockAssistant.undo = {
      mutateAsync: jest.fn<Promise<UndoAnswer>, [{ actionIds: string[] }]>(),
      isPending: false,
    };
  });

  describe("its header", () => {
    it("should be headed What the assistant changed, with Back to Assistant", async () => {
      const user = await renderChanges();

      expect(screen.getByRole("heading", { name: "What the assistant changed" })).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Back to Assistant" }));
      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should go to the Assistant settings when there is no screen to go back to", async () => {
      routerMock.canGoBack.mockReturnValue(false);
      const user = await renderChanges();

      await user.press(screen.getByRole("button", { name: "Back to Assistant" }));

      expect(routerMock.back).not.toHaveBeenCalled();
      expect(routerMock.replace).toHaveBeenCalledWith("/more/assistant");
    });

    it("should draw the sheet header as the board does: a raised back control and the title at the start", async () => {
      await renderChanges();

      expect(screen.getByRole("button", { name: "Back to Assistant" })).toHaveStyle({
        height: controlHeight.md,
        width: touchTarget,
        borderWidth: 1,
      });
      expect(screen.getByRole("heading", { name: "What the assistant changed" })).toHaveStyle({
        textAlign: "left",
      });
    });
  });

  describe("assistant-settings · changes", () => {
    it("should group the rows by day, newest first, headed as the hook sends the days", async () => {
      await renderChanges();

      const headings = screen.getAllByRole("heading");

      expect(headings).toHaveLength(3);
      expect(headings[1]).toHaveTextContent("Today");
      expect(headings[2]).toHaveTextContent("Yesterday");
    });

    it("should draw every row's title and sub line as sent, in the hook's order", async () => {
      await renderChanges();

      // The role query does not resolve a list, so each day's list is found by its label, as the Settings list is.
      const today = within(screen.getByLabelText("Today"));
      expect(
        today.getByLabelText("Logged 2 eggs and toast at 08:10, 08:11 · 2 entries"),
      ).toBeOnTheScreen();
      expect(
        today.getByLabelText("Added recipe Lemon chicken traybake, 09:42 · 4 servings"),
      ).toBeOnTheScreen();
      expect(
        today.getByLabelText("Copied 8 entries from yesterday, 12:30, Undone"),
      ).toBeOnTheScreen();
      const yesterday = within(screen.getByLabelText("Yesterday"));
      expect(yesterday.getByLabelText("Archived recipe Pasta bake, 19:05")).toBeOnTheScreen();
      expect(
        yesterday.getByLabelText(
          "Logged a flat white at 07:30, 07:31 · changed in your diary since, Can't undo",
        ),
      ).toBeOnTheScreen();
    });

    it("should offer Undo on the three rows that can be undone and no other action", async () => {
      await renderChanges();

      expect(screen.getAllByRole("button", { name: /^Undo, / })).toHaveLength(3);
      expect(screen.getAllByRole("button")).toHaveLength(4);
    });

    it("should say Undone and Can't undo as plain words, with no button", async () => {
      await renderChanges();

      expect(screen.getByText("Undone")).toBeOnTheScreen();
      expect(screen.getByText("Can't undo")).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Undone/ })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Can't undo/ })).not.toBeOnTheScreen();
    });

    it("should mute the title of an undone row", async () => {
      await renderChanges();

      expect(screen.getByText("Copied 8 entries from yesterday")).toHaveStyle({
        color: resolvedColor("dark", "text-secondary"),
      });
      expect(screen.getByText("Logged a flat white at 07:30")).toHaveStyle({
        color: resolvedColor("dark", "text-primary"),
      });
    });

    it("should end with the footer", async () => {
      await renderChanges();

      expect(screen.getByText(FOOTER)).toBeOnTheScreen();
    });

    it("should draw no empty state", async () => {
      await renderChanges();

      expect(screen.queryByText("Nothing changed yet")).not.toBeOnTheScreen();
    });
  });

  describe("Undo", () => {
    it("should send that row's action ids, once, and then read Undone", async () => {
      mockAssistant.undo.mutateAsync.mockResolvedValue([
        { actionId: "a1", result: "undone" },
        { actionId: "a2", result: "undone" },
      ]);
      const user = await renderChanges();

      await user.press(undoButtonFor("Logged 2 eggs and toast at 08:10"));

      expect(mockAssistant.undo.mutateAsync).toHaveBeenCalledTimes(1);
      expect(mockAssistant.undo.mutateAsync).toHaveBeenCalledWith({ actionIds: ["a1", "a2"] });
      expect(
        screen.getByLabelText("Logged 2 eggs and toast at 08:10, 08:11 · 2 entries, Undone"),
      ).toBeOnTheScreen();
      expect(
        screen.queryByRole("button", { name: "Undo, Logged 2 eggs and toast at 08:10" }),
      ).not.toBeOnTheScreen();
    });

    it("should leave the other rows as they were", async () => {
      mockAssistant.undo.mutateAsync.mockResolvedValue([{ actionId: "a3", result: "undone" }]);
      const user = await renderChanges();

      await user.press(undoButtonFor("Added recipe Lemon chicken traybake"));

      expect(undoButtonFor("Logged 2 eggs and toast at 08:10")).toBeOnTheScreen();
      expect(undoButtonFor("Archived recipe Pasta bake")).toBeOnTheScreen();
    });

    it("should read Can't undo when the entries were changed since", async () => {
      mockAssistant.undo.mutateAsync.mockResolvedValue([
        { actionId: "a5", result: "undo_unavailable" },
      ]);
      const user = await renderChanges();

      await user.press(undoButtonFor("Archived recipe Pasta bake"));

      expect(
        screen.getByLabelText("Archived recipe Pasta bake, 19:05, Can't undo"),
      ).toBeOnTheScreen();
    });

    it("should read Undone when someone got there first", async () => {
      mockAssistant.undo.mutateAsync.mockResolvedValue([
        { actionId: "a5", result: "already_undone" },
      ]);
      const user = await renderChanges();

      await user.press(undoButtonFor("Archived recipe Pasta bake"));

      expect(screen.getByLabelText("Archived recipe Pasta bake, 19:05, Undone")).toBeOnTheScreen();
    });

    it("should keep Undo when the request fails, because nothing was undone that the row knows of", async () => {
      mockAssistant.undo.mutateAsync.mockRejectedValue(new Error("offline"));
      const user = await renderChanges();

      await user.press(undoButtonFor("Archived recipe Pasta bake"));

      expect(undoButtonFor("Archived recipe Pasta bake")).toBeOnTheScreen();
    });

    it("should not send again while an undo is running", async () => {
      mockAssistant.undo.isPending = true;
      const user = await renderChanges();

      await user.press(undoButtonFor("Archived recipe Pasta bake"));

      expect(mockAssistant.undo.mutateAsync).not.toHaveBeenCalled();
    });
  });

  describe("assistant-settings · changes-empty", () => {
    beforeEach(() => {
      mockAssistant.changes = { data: { days: [], count: 0 } };
    });

    it("should say nothing changed yet, in the board's words", async () => {
      await renderChanges();

      expect(screen.getByText("Nothing changed yet")).toBeOnTheScreen();
      expect(
        screen.getByText(
          "When the assistant logs, copies or changes something for you, it shows here with Undo.",
        ),
      ).toBeOnTheScreen();
    });

    it("should draw no footer and no Undo", async () => {
      await renderChanges();

      expect(screen.queryByText(FOOTER)).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Undo/ })).not.toBeOnTheScreen();
    });
  });

  describe("before the list is read", () => {
    it("should draw the header alone, with neither the list nor the empty state", async () => {
      mockAssistant.changes = { data: undefined };
      await renderChanges();

      expect(screen.getByRole("heading", { name: "What the assistant changed" })).toBeOnTheScreen();
      expect(screen.queryByText("Nothing changed yet")).not.toBeOnTheScreen();
      expect(screen.queryByText(FOOTER)).not.toBeOnTheScreen();
    });
  });

  // The rows of `assistant-settings · changes-training`, as the hook words them from the stored cards.
  describe("assistant-settings · changes-training", () => {
    const training = {
      kind: "routine_updated",
      changedSinceDetail: "changed in the app since",
    } as const;
    const trainingChanges: AssistantChanges = {
      count: 4,
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
              key: "t5",
              actionIds: ["t5"],
              title: "Updated exercise Cable row",
              sub: "09:30",
              state: "undo",
              training: { kind: "exercise_updated", changedSinceDetail: "changed since" },
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

    beforeEach(() => {
      mockAssistant.changes = { data: trainingChanges };
    });

    it("should draw each training row's title and sub as sent, with Undo", async () => {
      await renderChanges();

      expect(screen.getByText("Updated routine Push Pull Legs")).toBeOnTheScreen();
      expect(screen.getByText("08:12 · 4 changes")).toBeOnTheScreen();
      expect(screen.getByText("09:02 · Thu 8 Oct")).toBeOnTheScreen();
      expect(screen.getAllByRole("button", { name: /^Undo, / })).toHaveLength(4);
    });

    it("should send the row's action ids when Undo is pressed on a training row, and read Undone", async () => {
      mockAssistant.undo.mutateAsync.mockResolvedValue([{ actionId: "t1", result: "undone" }]);
      const user = await renderChanges();

      await user.press(undoButtonFor("Updated routine Push Pull Legs"));

      expect(mockAssistant.undo.mutateAsync).toHaveBeenCalledWith({ actionIds: ["t1"] });
      expect(
        screen.getByLabelText("Updated routine Push Pull Legs, 08:12 · 4 changes, Undone"),
      ).toBeOnTheScreen();
    });

    describe("while a workout is in progress", () => {
      beforeEach(() => {
        mockAssistant.activeSession = { data: { id: "session-1" } };
      });

      it("should say Can't undo yet with no button, on every training row", async () => {
        await renderChanges();

        expect(screen.getAllByText("Can't undo yet")).toHaveLength(4);
        expect(screen.queryByRole("button", { name: /^Undo, / })).not.toBeOnTheScreen();
      });

      it("should leave a food row's Undo as it was", async () => {
        mockAssistant.changes = {
          data: {
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
          },
        };
        await renderChanges();

        expect(undoButtonFor("Logged 2 eggs and toast at 08:10")).toBeOnTheScreen();
        expect(screen.getAllByText("Can't undo yet")).toHaveLength(1);
      });
    });

    it("should read Can't undo, with changed in the app since, when a press says the routine changed", async () => {
      mockAssistant.undo.mutateAsync.mockResolvedValue([
        { actionId: "t6", result: "undo_unavailable", reason: "changed" },
      ]);
      const user = await renderChanges();

      await user.press(undoButtonFor("Archived routine Starting strength"));

      expect(
        screen.getByLabelText(
          "Archived routine Starting strength, 18:40 · changed in the app since, Can't undo",
        ),
      ).toBeOnTheScreen();
    });

    it("should read changed since for an exercise", async () => {
      mockAssistant.undo.mutateAsync.mockResolvedValue([
        { actionId: "t5", result: "undo_unavailable", reason: "changed" },
      ]);
      const user = await renderChanges();

      await user.press(undoButtonFor("Updated exercise Cable row"));

      expect(
        screen.getByLabelText("Updated exercise Cable row, 09:30 · changed since, Can't undo"),
      ).toBeOnTheScreen();
    });

    it("should read plain Can't undo when the answer gave no reason", async () => {
      mockAssistant.undo.mutateAsync.mockResolvedValue([
        { actionId: "t1", result: "undo_unavailable" },
      ]);
      const user = await renderChanges();

      await user.press(undoButtonFor("Updated routine Push Pull Legs"));

      expect(
        screen.getByLabelText("Updated routine Push Pull Legs, 08:12 · 4 changes, Can't undo"),
      ).toBeOnTheScreen();
    });

    it("should say what was put back when only some of three sets were", async () => {
      mockAssistant.undo.mutateAsync.mockResolvedValue([
        { actionId: "t2", result: "undone" },
        { actionId: "t3", result: "undone" },
        { actionId: "t4", result: "undo_unavailable", reason: "changed" },
      ]);
      const user = await renderChanges();

      await user.press(undoButtonFor("Changed 3 sets in Legs"));

      expect(
        screen.getByLabelText("Changed 3 sets in Legs, 09:02 · Put back 2 of 3 sets, Can't undo"),
      ).toBeOnTheScreen();
    });

    it("should wait while the workout lasts after a press it refused, and offer Undo again once it ends", async () => {
      mockAssistant.undo.mutateAsync.mockResolvedValue([
        { actionId: "t1", result: "undo_unavailable", reason: "workout_in_progress" },
      ]);
      const user = await renderChanges();
      const rerender = () =>
        screen.rerender(
          <ThemeProvider fixedPreference="dark">
            <AssistantChangesRoute />
          </ThemeProvider>,
        );

      await user.press(undoButtonFor("Updated routine Push Pull Legs"));
      mockAssistant.activeSession = { data: { id: "session-1" } };
      await rerender();

      expect(
        screen.getByLabelText("Updated routine Push Pull Legs, 08:12 · 4 changes, Can't undo yet"),
      ).toBeOnTheScreen();

      mockAssistant.activeSession = { data: null };
      await rerender();

      expect(undoButtonFor("Updated routine Push Pull Legs")).toBeOnTheScreen();
    });
  });
});
