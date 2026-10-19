import "react-native-gesture-handler/jestSetup";

import { KeyLowProvider } from "@keylow/api-client";
import { ROUTINE_DISCARD, ROUTINE_EDITOR } from "@keylow/core/copy";
import { QueryClient } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { ExpoRoot, Slot, router } from "expo-router";
import { getMockContext } from "expo-router/testing-library";
import { Text } from "react-native";
import { setUpTests } from "react-native-reanimated";

import TrainLayout from "../app/(tabs)/train/_layout";
import EditRoutineRoute from "../app/(tabs)/train/routines/[id]";
import NewRoutineRoute from "../app/(tabs)/train/routines/new";
import { ToastProvider } from "../components/ui";
import { routinesPath, trainPath } from "../lib/routineRoutes";
import { ThemeProvider } from "../lib/theme";
import { resetDiaryBackend } from "./support/diaryBackend";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import {
  resetRoutineDetailBackend,
  routineDetailBackend,
  routineDetailClient,
} from "./support/routineDetailBackend";
import { pushPullLegsDraft } from "./support/routineEditorFixtures";

// The editor inside the real navigator: Train, the routines list, then the editor pushed over them, and what
// leaving it does to that stack. The screens beside the editor are headings.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

setUpTests();

const ROUTINE_ID = "55555555-5555-4555-8555-555555555555";

const standIn = (text: string) =>
  function StandIn() {
    return <Text role="heading">{text}</Text>;
  };

let queryClient: QueryClient;

function Providers() {
  return (
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={routineDetailClient} queryClient={queryClient}>
        <ToastProvider>
          <Slot />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>
  );
}

async function openAt(location: string) {
  await render(
    <ExpoRoot
      context={getMockContext({
        _layout: Providers,
        "(tabs)/_layout": () => <Slot />,
        "(tabs)/train/_layout": TrainLayout,
        "(tabs)/train/index": standIn("Train screen"),
        "(tabs)/train/routines": standIn("Routines list"),
        "(tabs)/train/routines/archived": standIn("Archived routines"),
        "(tabs)/train/routines/new": NewRoutineRoute,
        "(tabs)/train/routines/[id]": EditRoutineRoute,
      })}
      location={location}
    />,
  );
}

// Train, the routines list, then the editor at the address, with the list under it.
async function openEditorOverTheList(address: string) {
  await openAt(trainPath());
  await screen.findByRole("heading", { name: "Train screen" });
  await act(() => {
    router.push(routinesPath());
  });
  await act(() => {
    router.push(address);
  });
  return screen.findByLabelText(ROUTINE_EDITOR.nameLabel);
}

// Lets the stack settle after a screen is popped, which would show a second pop.
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

const expectOnTheRoutinesList = () => {
  expect(screen.getByRole("heading", { name: "Routines list" })).toBeOnTheScreen();
  expect(screen.queryByRole("heading", { name: "Train screen" })).not.toBeOnTheScreen();
};

describe("leaving the routine editor in the navigator", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/RoutineEditor",
      "components/RoutineDayCard",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetDiaryBackend();
    resetRoutineDetailBackend();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
  });

  it("should land on the routines list, and not on Train, after the changes are discarded", async () => {
    const user = userEvent.setup();
    await fireEvent.changeText(await openEditorOverTheList(`${routinesPath()}/new`), "Upper Lower");

    await user.press(screen.getByRole("button", { name: ROUTINE_EDITOR.cancelLabel }));
    await user.press(screen.getByRole("button", { name: ROUTINE_DISCARD.discardAction }));
    await settle();

    expectOnTheRoutinesList();
  });

  it("should land on the routines list after Cancel editing with nothing changed", async () => {
    const user = userEvent.setup();
    await openEditorOverTheList(`${routinesPath()}/new`);

    await user.press(screen.getByRole("button", { name: ROUTINE_EDITOR.cancelLabel }));
    await settle();

    expectOnTheRoutinesList();
  });

  it("should ask on the back gesture with changes, stay on Keep editing and land on the list on Discard", async () => {
    const user = userEvent.setup();
    await fireEvent.changeText(await openEditorOverTheList(`${routinesPath()}/new`), "Upper Lower");

    await act(() => {
      router.back();
    });
    expect(screen.getByRole("heading", { name: ROUTINE_DISCARD.title })).toBeOnTheScreen();
    await user.press(screen.getByRole("button", { name: ROUTINE_DISCARD.keepEditingAction }));
    expect(screen.getByLabelText(ROUTINE_EDITOR.nameLabel)).toHaveDisplayValue("Upper Lower");
    await act(() => {
      router.back();
    });
    await user.press(screen.getByRole("button", { name: ROUTINE_DISCARD.discardAction }));
    await settle();

    expectOnTheRoutinesList();
  });

  it("should leave a saved routine's editor to the routines list in the same way", async () => {
    routineDetailBackend.routines.set(ROUTINE_ID, pushPullLegsDraft);
    const user = userEvent.setup();
    await fireEvent.changeText(
      await openEditorOverTheList(`${routinesPath()}/${ROUTINE_ID}`),
      "Upper Lower",
    );

    await user.press(screen.getByRole("button", { name: ROUTINE_EDITOR.cancelLabel }));
    await user.press(screen.getByRole("button", { name: ROUTINE_DISCARD.discardAction }));
    await settle();

    expectOnTheRoutinesList();
  });

  it("should open the routines list from an address that is not a routine, popping back to the list under it", async () => {
    await openAt(trainPath());
    await screen.findByRole("heading", { name: "Train screen" });
    await act(() => {
      router.push(routinesPath());
    });

    await act(() => {
      router.push(`${routinesPath()}/not-a-uuid`);
    });
    await settle();

    expectOnTheRoutinesList();
    expect(routineDetailBackend.reads).toStrictEqual([]);
    // The list is the one that was under the editor, not a second one, so one step back is Train.
    await act(() => {
      router.back();
    });
    await settle();
    expect(screen.getByRole("heading", { name: "Train screen" })).toBeOnTheScreen();
  });
});
