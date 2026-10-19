import { KeyLowProvider } from "@keylow/api-client";
import { ADD_EXERCISE } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import {
  act,
  cleanup,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { AddExerciseSheet } from "../components/AddExerciseSheet";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { lateralRaiseExercises, SIDE_LATERAL_RAISE_ID } from "./support/exerciseCatalogue";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { expectTextsInOrder } from "./support/textsInOrder";
import {
  resetTrainBackend,
  trainBackend,
  trainClient,
  trainRequestsTo,
} from "./support/trainBackend";

import type { AddExerciseSheetProps, ChosenExercise } from "../components/AddExerciseSheet";
import type { QueryClient } from "@tanstack/react-query";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

// Jest does not turn the library's scroll handlers into worklets, so its scroll view cannot render here. The
// plain scroll view stands in for it. How the library drags a sheet with it is on the device.
jest.mock("@gorhom/bottom-sheet", () => {
  const { forwardRef } = jest.requireActual<typeof import("react")>("react");
  const { ScrollView } = jest.requireActual<typeof import("react-native")>("react-native");
  const actual = jest.requireActual<typeof import("@gorhom/bottom-sheet")>("@gorhom/bottom-sheet");
  return {
    __esModule: true,
    default: actual.default,
    BottomSheetView: actual.BottomSheetView,
    BottomSheetTextInput: actual.BottomSheetTextInput,
    BottomSheetBackdrop: actual.BottomSheetBackdrop,
    BottomSheetScrollView: forwardRef<never, object>(function FakeSheetScrollView(props, ref) {
      return <ScrollView ref={ref} {...props} />;
    }),
  };
});

setUpTests();

let queryClient: QueryClient;

async function renderSheet(props: AddExerciseSheetProps) {
  queryClient = createDiaryQueryClient();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={trainClient} queryClient={queryClient}>
        <AddExerciseSheet {...props} />
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

type SessionOverrides = {
  onClose?: () => void;
  onAddToSession?: (exercise: ChosenExercise) => void;
  onCreate?: (name: string) => void;
};

const sessionProps = ({
  onClose = jest.fn(),
  onAddToSession = jest.fn(),
  onCreate,
}: SessionOverrides = {}): AddExerciseSheetProps => ({
  mode: "session",
  open: true,
  onAddToSession,
  onClose,
  onCreate,
});

async function search(words: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByRole("searchbox", { name: ADD_EXERCISE.searchName }), words);
  return user;
}

describe("the Add exercise sheet", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/AddExerciseSheet",
      "components/ExerciseRow",
      "app",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetTrainBackend();
    trainBackend.exercises = lateralRaiseExercises;
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  describe("searching lateral raise", () => {
    it("should list your own exercise first under Your exercises, then the library", async () => {
      await renderSheet(sessionProps());
      await search("lateral raise");

      await screen.findByRole("heading", { name: "Your exercises · 1" });
      expectTextsInOrder(screen.getAllByRole("heading").slice(1), [
        "Your exercises · 1",
        "Library · 4",
      ]);
    });

    it("should name each row with the exercise, its equipment and Custom for your own", async () => {
      await renderSheet(sessionProps());
      await search("lateral raise");

      expect(
        await screen.findByRole("button", { name: "Add Lean-away cable raise, Cable, Custom" }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole("button", { name: "Add Side lateral raise, Dumbbell" }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole("button", { name: "Add Upright barbell row, Barbell" }),
      ).toBeOnTheScreen();
    });

    it("should draw the equipment and up to two muscle chips on a row", async () => {
      await renderSheet(sessionProps());
      await search("lateral raise");

      const row = within(
        await screen.findByRole("button", { name: "Add Upright barbell row, Barbell" }),
      );
      expect(row.getByText("Barbell ·")).toBeOnTheScreen();
      expect(row.getByText("Side delts")).toBeOnTheScreen();
      expect(row.getByText("Upper traps")).toBeOnTheScreen();
    });

    it("should show the Custom pill on your own exercise only", async () => {
      await renderSheet(sessionProps());
      await search("lateral raise");

      await screen.findByRole("button", { name: "Add Side lateral raise, Dumbbell" });
      expect(screen.getAllByText("Custom")).toHaveLength(1);
    });
  });

  describe("a short or empty search", () => {
    it("should send nothing and show no result for one character", async () => {
      await renderSheet(sessionProps());
      await search("l");

      await act(() => new Promise((resolve) => setTimeout(resolve, 400)));

      expect(trainRequestsTo("exercise_search")).toBe(0);
      expect(screen.queryByRole("heading", { name: /Library|Your exercises/ })).toBeNull();
      expect(screen.queryByText(ADD_EXERCISE.noResults)).toBeNull();
    });

    it("should show the empty row when nothing matches", async () => {
      trainBackend.exercises = [];
      await renderSheet(sessionProps());
      await search("zzz");

      expect(await screen.findByText(ADD_EXERCISE.noResults)).toBeOnTheScreen();
    });
  });

  describe("choosing an exercise", () => {
    it("should add the exercise to the session in session mode and close", async () => {
      const onAddToSession = jest.fn();
      const onClose = jest.fn();
      await renderSheet(sessionProps({ onClose, onAddToSession }));
      const user = await search("lateral raise");

      await user.press(
        await screen.findByRole("button", { name: "Add Side lateral raise, Dumbbell" }),
      );

      expect(onAddToSession).toHaveBeenCalledWith(
        expect.objectContaining({ id: SIDE_LATERAL_RAISE_ID, name: "Side lateral raise" }),
      );
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should return the exercise in routine mode and change no session", async () => {
      const onChoose = jest.fn();
      const onAddToSession = jest.fn();
      const onClose = jest.fn();
      // A session handler beside the routine ones: routine mode must leave it alone.
      const routineProps = {
        mode: "routine",
        open: true,
        onChoose,
        onClose,
        onAddToSession,
      } as const;
      await renderSheet(routineProps);
      const user = await search("lateral raise");

      await user.press(
        await screen.findByRole("button", { name: "Add Side lateral raise, Dumbbell" }),
      );

      expect(onChoose).toHaveBeenCalledWith(
        expect.objectContaining({ id: SIDE_LATERAL_RAISE_ID, name: "Side lateral raise" }),
      );
      expect(onAddToSession).not.toHaveBeenCalled();
      expect(trainRequestsTo("active_session")).toBe(0);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("a failed search", () => {
    it("should say the search did not load, not that nothing matches", async () => {
      trainBackend.failingTables.add("exercise_search");
      await renderSheet(sessionProps());
      await search("lateral raise");

      expect(await screen.findByText(ADD_EXERCISE.exerciseSearchFailed)).toBeOnTheScreen();
      expect(screen.queryByText(ADD_EXERCISE.noResults)).toBeNull();
      expect(screen.queryByText("raw database text")).toBeNull();
    });
  });

  describe("pressing a row twice", () => {
    it("should choose the exercise once", async () => {
      const onAddToSession = jest.fn();
      await renderSheet(sessionProps({ onAddToSession }));
      const user = await search("lateral raise");
      const row = await screen.findByRole("button", { name: "Add Side lateral raise, Dumbbell" });

      await user.press(row);
      await user.press(row);

      expect(onAddToSession).toHaveBeenCalledTimes(1);
    });
  });

  describe("the Create row", () => {
    it("should not be drawn without a handler", async () => {
      await renderSheet(sessionProps());
      await search("lateral raise");

      await screen.findByRole("heading", { name: "Library · 4" });
      expect(screen.queryByRole("button", { name: /^Create/ })).toBeNull();
    });

    it("should hand the searched words to the handler when given one", async () => {
      const onCreate = jest.fn();
      await renderSheet(sessionProps({ onCreate }));
      const user = await search("lateral raise");

      await user.press(await screen.findByRole("button", { name: 'Create "lateral raise"' }));

      expect(onCreate).toHaveBeenCalledWith("lateral raise");
    });
  });

  describe("offline", () => {
    it("should show the offline line and search nothing", async () => {
      await act(() => {
        onlineManager.setOnline(false);
      });
      await renderSheet(sessionProps());
      await search("lateral raise");

      expect(await screen.findByText(ADD_EXERCISE.exerciseSearchOffline)).toBeOnTheScreen();
      await waitFor(() => {
        expect(trainRequestsTo("exercise_search")).toBe(0);
      });
    });
  });

  it("should close from the Close control", async () => {
    const onClose = jest.fn();
    await renderSheet(sessionProps({ onClose }));
    const user = userEvent.setup();

    await user.press(await screen.findByRole("button", { name: ADD_EXERCISE.closeName }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
