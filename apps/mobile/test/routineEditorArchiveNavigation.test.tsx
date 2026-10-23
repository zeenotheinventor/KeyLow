import "react-native-gesture-handler/jestSetup";

import { KeyLowProvider } from "@keylow/api-client";
import {
  ROUTINE_ARCHIVED_TOAST,
  ROUTINE_EDITOR,
  ROUTINE_RESTORE_FAILED,
  ROUTINES_SCREEN,
  describeArchivedRoutinesLink,
} from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { ExpoRoot, Slot } from "expo-router";
import { getMockContext } from "expo-router/testing-library";
import { Text } from "react-native";
import { setUpTests } from "react-native-reanimated";

import TrainLayout from "../app/(tabs)/train/_layout";
import RoutinesRoute from "../app/(tabs)/train/routines";
import EditRoutineRoute from "../app/(tabs)/train/routines/[id]";
import { ToastProvider } from "../components/ui";
import { routinesPath } from "../lib/routineRoutes";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient, resetDiaryBackend } from "./support/diaryBackend";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import {
  resetRoutineStatusBackend,
  routineStatusBackend,
  routineStatusClient,
  storedRoutine,
} from "./support/routineStatusBackend";
import { resetTrainBackend } from "./support/trainBackend";

import type { QueryClient } from "@tanstack/react-query";

// Archiving from the editor inside the real navigator, from the routines list: the editor leaves for the
// list, and the Undo of the toast, which the provider holds, still works with the editor gone.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
// 17:55 in London on Thursday 15 October 2026, which is BST.
jest.mock("../lib/useNow", () => ({ useNow: () => new Date("2026-10-15T16:55:00Z") }));
// The navigator's imports bring the library's mock of Reanimated with them, which the library's sheet cannot run
// on. A sheet that draws its content while it is open stands in for it: how the library drags and snaps one is on the device.
jest.mock("../components/ui/BottomSheet/BottomSheet", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    BottomSheet: ({
      open,
      title,
      label,
      children,
    }: {
      open: boolean;
      title?: string;
      label?: string;
      children: import("react").ReactNode;
    }) =>
      open ? (
        <View aria-label={title ?? label} role="dialog">
          {children}
        </View>
      ) : null,
  };
});
jest.mock("../components/ui/BottomSheet/SheetScrollView", () => ({
  SheetScrollView: jest.requireActual<typeof import("react-native")>("react-native").ScrollView,
}));

setUpTests();

const standIn = (text: string) =>
  function StandIn() {
    return <Text role="heading">{text}</Text>;
  };

let queryClient: QueryClient;

function Providers() {
  return (
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={routineStatusClient} queryClient={queryClient}>
        <ToastProvider>
          <Slot />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>
  );
}

async function openTheRoutinesList() {
  await render(
    <ExpoRoot
      context={getMockContext({
        _layout: Providers,
        "(tabs)/_layout": () => <Slot />,
        "(tabs)/train/_layout": TrainLayout,
        "(tabs)/train/index": standIn("Train screen"),
        "(tabs)/train/routines": RoutinesRoute,
        "(tabs)/train/routines/archived": standIn("Archived routines"),
        "(tabs)/train/routines/[id]": EditRoutineRoute,
      })}
      location={routinesPath()}
    />,
  );
}

// Lets the stack settle after a screen is pushed or popped.
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

const pushPullLegs = () =>
  storedRoutine(
    "Push Pull Legs",
    [
      { name: "Push", weekday: 0, exercises: [3, 3] },
      { name: "Pull", weekday: 1, exercises: [3, 3] },
    ],
    { isActive: true, activatedAt: "2026-10-01T08:00:00+00:00" },
  );

const upperLower = () =>
  storedRoutine("Upper Lower", [
    { name: "Upper", weekday: 0, exercises: [3, 3] },
    { name: "Lower", weekday: 1, exercises: [3, 3] },
  ]);

const makeActiveButton = { name: "Make active, Upper Lower" };

describe("archiving a routine from its editor, in the navigator", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "app",
      "components/RoutinesScreen",
      "components/RoutinesView",
      "components/RoutineCard",
      "components/RoutineRow",
      "components/RoutineEditor",
      "components/RoutineDayCard",
      "components/ui/ActionMenu",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetDiaryBackend();
    resetTrainBackend();
    resetRoutineStatusBackend();
    routineStatusBackend.routines = [pushPullLegs(), upperLower()];
    queryClient = createDiaryQueryClient();
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  async function archiveUpperLowerFromItsEditor() {
    const user = userEvent.setup();
    await openTheRoutinesList();
    await user.press(await screen.findByRole("button", { name: /^Upper Lower/ }));
    await user.press(await screen.findByRole("button", { name: ROUTINE_EDITOR.moreLabel }));
    await user.press(screen.getByRole("button", { name: ROUTINE_EDITOR.archiveAction }));
    await settle();
    return user;
  }

  it("should leave the editor for the list, which moves the routine under Archived with the toast", async () => {
    await archiveUpperLowerFromItsEditor();

    expect(await screen.findByRole("heading", { name: ROUTINES_SCREEN.title })).toBeOnTheScreen();
    expect(screen.queryByLabelText(ROUTINE_EDITOR.nameLabel)).not.toBeOnTheScreen();
    expect(screen.queryByText("Upper Lower")).not.toBeOnTheScreen();
    expect(
      await screen.findByRole("button", { name: describeArchivedRoutinesLink(1) }),
    ).toBeOnTheScreen();
    expect(screen.getByRole("status", { name: ROUTINE_ARCHIVED_TOAST.message })).toBeOnTheScreen();
  });

  it("should put the routine back under Other routines with its days when Undo is pressed after the editor has gone", async () => {
    const user = await archiveUpperLowerFromItsEditor();
    await screen.findByRole("button", { name: describeArchivedRoutinesLink(1) });

    await user.press(screen.getByRole("button", { name: ROUTINE_ARCHIVED_TOAST.undoAction }));

    expect(await screen.findByRole("button", makeActiveButton)).toBeOnTheScreen();
    expect(
      screen.queryByRole("button", { name: describeArchivedRoutinesLink(1) }),
    ).not.toBeOnTheScreen();
    expect(routineStatusBackend.archiveUpdates.map(({ archived }) => archived)).toEqual([
      true,
      false,
    ]);
    expect(screen.getByText("2 days · Mon, Tue · 12 sets a week")).toBeOnTheScreen();
  });

  it("should say the routine was not restored, and leave it archived, when Undo fails", async () => {
    const user = await archiveUpperLowerFromItsEditor();
    await screen.findByRole("button", { name: describeArchivedRoutinesLink(1) });
    routineStatusBackend.failWrites = true;

    await user.press(screen.getByRole("button", { name: ROUTINE_ARCHIVED_TOAST.undoAction }));

    expect(await screen.findByRole("status", { name: ROUTINE_RESTORE_FAILED })).toBeOnTheScreen();
    await waitFor(() => {
      expect(screen.queryByRole("button", makeActiveButton)).not.toBeOnTheScreen();
    });
    expect(screen.getByRole("button", { name: describeArchivedRoutinesLink(1) })).toBeOnTheScreen();
  });
});
