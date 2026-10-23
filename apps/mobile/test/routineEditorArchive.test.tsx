import "react-native-gesture-handler/jestSetup";

import { KeyLowProvider } from "@keylow/api-client";
import {
  ARCHIVE_ACTIVE_REFUSAL,
  ROUTINE_ARCHIVE_FAILED,
  ROUTINE_ARCHIVE_UNSAVED,
  ROUTINE_ARCHIVED_TOAST,
  ROUTINE_EDITOR,
} from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { RoutineEditor } from "../components/RoutineEditor";
import { RoutineEditorScreen } from "../components/RoutineEditorScreen";
import { ToastProvider } from "../components/ui";
import { routinesPath } from "../lib/routineRoutes";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient, resetDiaryBackend } from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import {
  resetRoutineStatusBackend,
  routineStatusBackend,
  routineStatusClient,
  storedRoutine,
} from "./support/routineStatusBackend";
import { pressTwiceInTheSameMoment } from "./support/sameTickPress";

import type { QueryClient } from "@tanstack/react-query";

// Archiving a routine from its editor: the More control beside Save, the menu with its one item, when the
// item is dimmed and why, and what the archive does and says, over a fake database that answers as the real
// one does. Undo after the editor has gone is tested in the navigator, in routineEditorArchiveNavigation.

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
jest.mock("expo-router/react-navigation", () => ({ usePreventRemove: () => undefined }));

setUpTests();

const moreButton = { name: ROUTINE_EDITOR.moreLabel };
const archiveItem = { name: ROUTINE_EDITOR.archiveAction };
const archiveItemDimmed = (caption: string) => ({
  name: `${ROUTINE_EDITOR.archiveAction}, ${caption}`,
});

const upperLower = (flags: Parameters<typeof storedRoutine>[2] = {}) =>
  storedRoutine(
    "Upper Lower",
    [
      { name: "Upper", weekday: 0, exercises: [3, 3] },
      { name: "Lower", weekday: 1, exercises: [3, 3] },
    ],
    flags,
  );

let queryClient: QueryClient;

async function showEditorFor(routineId: string) {
  queryClient = createDiaryQueryClient();
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={routineStatusClient} queryClient={queryClient}>
        <ToastProvider>
          <RoutineEditorScreen id={routineId} />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  await screen.findByLabelText(ROUTINE_EDITOR.nameLabel);
  return user;
}

async function openTheMenu(user: Awaited<ReturnType<typeof showEditorFor>>) {
  await user.press(screen.getByRole("button", moreButton));
}

function seedOne(flags: Parameters<typeof storedRoutine>[2] = {}) {
  const routine = upperLower(flags);
  routineStatusBackend.routines = [routine];
  return routine;
}

describe("archiving a routine from its editor", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/RoutineEditorScreen",
      "components/RoutineEditor",
      "components/RoutineDayCard",
      "components/ui/ActionMenu",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetDiaryBackend();
    resetRoutineStatusBackend();
    resetRouterMock();
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  describe("the More control", () => {
    it("should be drawn beside Save for a routine that is stored and not archived", async () => {
      seedOne();
      await showEditorFor(routineStatusBackend.routines[0]?.id ?? "");

      expect(screen.getByRole("button", moreButton)).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: ROUTINE_EDITOR.saveAction })).toBeOnTheScreen();
    });

    it("should not be drawn while a routine is being created", async () => {
      await render(
        <ThemeProvider fixedPreference="dark">
          <KeyLowProvider client={routineStatusClient} queryClient={createDiaryQueryClient()}>
            <ToastProvider>
              <RoutineEditor />
            </ToastProvider>
          </KeyLowProvider>
        </ThemeProvider>,
      );

      expect(screen.getByRole("button", { name: ROUTINE_EDITOR.saveAction })).toBeOnTheScreen();
      expect(screen.queryByRole("button", moreButton)).not.toBeOnTheScreen();
    });

    it("should not be drawn for a routine that is already archived", async () => {
      seedOne({ isArchived: true });
      await showEditorFor(routineStatusBackend.routines[0]?.id ?? "");

      expect(screen.queryByRole("button", moreButton)).not.toBeOnTheScreen();
    });
  });

  describe("the menu", () => {
    it("should hold Archive routine, enabled for a routine that is not active and not changed", async () => {
      seedOne();
      const user = await showEditorFor(routineStatusBackend.routines[0]?.id ?? "");

      await openTheMenu(user);

      expect(screen.getByRole("button", archiveItem)).toBeEnabled();
    });

    it("should dim Archive routine for the active routine, with the reason, and do nothing when pressed", async () => {
      seedOne({ isActive: true, activatedAt: "2026-10-01T08:00:00+00:00" });
      const user = await showEditorFor(routineStatusBackend.routines[0]?.id ?? "");
      await openTheMenu(user);

      const item = screen.getByRole("button", archiveItemDimmed(ARCHIVE_ACTIVE_REFUSAL));
      expect(item).toBeDisabled();
      expect(screen.getByText(ARCHIVE_ACTIVE_REFUSAL)).toBeOnTheScreen();
      await user.press(item);

      expect(routineStatusBackend.archiveUpdates).toEqual([]);
      expect(routerMock.dismissTo).not.toHaveBeenCalled();
    });

    it("should dim Archive routine while the draft has changes that are not saved, with the reason", async () => {
      seedOne();
      const user = await showEditorFor(routineStatusBackend.routines[0]?.id ?? "");
      await user.type(screen.getByLabelText(ROUTINE_EDITOR.nameLabel), " 2");
      await openTheMenu(user);

      const item = screen.getByRole("button", archiveItemDimmed(ROUTINE_ARCHIVE_UNSAVED));
      expect(item).toBeDisabled();
      await user.press(item);

      expect(routineStatusBackend.archiveUpdates).toEqual([]);
    });

    it("should dim Archive routine while a save of an unchanged draft is on its way", async () => {
      const routine = seedOne();
      const user = await showEditorFor(routine.id);
      let release = () => {};
      routineStatusBackend.holdSave = new Promise((resolve) => {
        release = resolve;
      });
      await user.press(screen.getByRole("button", { name: ROUTINE_EDITOR.saveAction }));
      await waitFor(() => {
        expect(routineStatusBackend.saveRequests).toBe(1);
      });
      await openTheMenu(user);

      const item = screen.getByRole("button", archiveItemDimmed(ROUTINE_ARCHIVE_UNSAVED));
      expect(item).toBeDisabled();
      await user.press(item);
      release();

      await waitFor(() => {
        expect(routerMock.dismissTo).toHaveBeenCalledTimes(1);
      });
      expect(routineStatusBackend.archiveUpdates).toEqual([]);
    });

    it("should give the active reason before the unsaved one when both hold", async () => {
      seedOne({ isActive: true, activatedAt: "2026-10-01T08:00:00+00:00" });
      const user = await showEditorFor(routineStatusBackend.routines[0]?.id ?? "");
      await user.type(screen.getByLabelText(ROUTINE_EDITOR.nameLabel), " 2");
      await openTheMenu(user);

      expect(
        screen.getByRole("button", archiveItemDimmed(ARCHIVE_ACTIVE_REFUSAL)),
      ).toBeOnTheScreen();
    });
  });

  describe("pressing Archive routine", () => {
    it("should archive the routine, leave for the routines list and say so with an Undo", async () => {
      const routine = seedOne();
      const user = await showEditorFor(routine.id);
      await openTheMenu(user);

      await user.press(screen.getByRole("button", archiveItem));

      await waitFor(() => {
        expect(routerMock.dismissTo).toHaveBeenCalledWith(routinesPath());
      });
      expect(routineStatusBackend.archiveUpdates).toEqual([{ id: routine.id, archived: true }]);
      expect(
        await screen.findByRole("status", { name: ROUTINE_ARCHIVED_TOAST.message }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole("button", { name: ROUTINE_ARCHIVED_TOAST.undoAction }),
      ).toBeOnTheScreen();
    });

    it("should archive once when it is pressed twice in the same moment", async () => {
      const routine = seedOne();
      const user = await showEditorFor(routine.id);
      await openTheMenu(user);
      let release = () => {};
      routineStatusBackend.holdWrites = new Promise((resolve) => {
        release = resolve;
      });

      await pressTwiceInTheSameMoment(screen.getByRole("button", archiveItem));
      release();

      await waitFor(() => {
        expect(routerMock.dismissTo).toHaveBeenCalledTimes(1);
      });
      expect(routineStatusBackend.archiveUpdates).toHaveLength(1);
    });

    it("should say it did not go through once when it is pressed twice in the same moment and fails", async () => {
      const routine = seedOne();
      const user = await showEditorFor(routine.id);
      await openTheMenu(user);
      routineStatusBackend.failWrites = true;
      const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockClear();

      await pressTwiceInTheSameMoment(screen.getByRole("button", archiveItem));

      expect(await screen.findByRole("status", { name: ROUTINE_ARCHIVE_FAILED })).toBeOnTheScreen();
      expect(announce.mock.calls.filter(([said]) => said === ROUTINE_ARCHIVE_FAILED)).toHaveLength(
        1,
      );
      expect(routineStatusBackend.archiveUpdates).toHaveLength(1);
    });

    it("should keep the editor open, change nothing and say so once when the write fails", async () => {
      const routine = seedOne();
      const user = await showEditorFor(routine.id);
      await openTheMenu(user);
      routineStatusBackend.failWrites = true;

      await user.press(screen.getByRole("button", archiveItem));

      expect(await screen.findByRole("status", { name: ROUTINE_ARCHIVE_FAILED })).toBeOnTheScreen();
      expect(screen.getAllByRole("status")).toHaveLength(1);
      expect(routerMock.dismissTo).not.toHaveBeenCalled();
      expect(screen.getByLabelText(ROUTINE_EDITOR.nameLabel)).toBeOnTheScreen();
      expect(routine.isArchived).toBe(false);
    });

    it("should not ask the database, and say so, when there is no connection", async () => {
      const routine = seedOne();
      const user = await showEditorFor(routine.id);
      await openTheMenu(user);
      await act(() => {
        onlineManager.setOnline(false);
      });

      await user.press(screen.getByRole("button", archiveItem));

      expect(await screen.findByRole("status", { name: ROUTINE_ARCHIVE_FAILED })).toBeOnTheScreen();
      expect(routineStatusBackend.archiveUpdates).toEqual([]);
      expect(routerMock.dismissTo).not.toHaveBeenCalled();
    });

    it("should give the refusal, and not the failure, when the routine became active elsewhere", async () => {
      const routine = seedOne();
      const user = await showEditorFor(routine.id);
      await openTheMenu(user);
      routine.isActive = true;

      await user.press(screen.getByRole("button", archiveItem));

      expect(await screen.findByRole("status", { name: ARCHIVE_ACTIVE_REFUSAL })).toBeOnTheScreen();
      expect(screen.queryByRole("status", { name: ROUTINE_ARCHIVE_FAILED })).not.toBeOnTheScreen();
      expect(routerMock.dismissTo).not.toHaveBeenCalled();
      expect(routine.isArchived).toBe(false);
    });
  });
});
