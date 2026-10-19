import {
  ROUTINES_ARCHIVED,
  ROUTINES_EMPTY,
  ROUTINES_SCREEN,
  TRAIN_LOADING_NAME,
  describeArchivedRoutineMeta,
  describeArchivedRoutinesLink,
} from "@keylow/core/copy";
import { cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { ArchivedRoutinesView } from "../components/ArchivedRoutinesView";
import { RoutinesView } from "../components/RoutinesView";
import {
  sampleActiveRoutine,
  sampleArchivedRoutines,
  sampleOtherRoutines,
} from "../components/RoutinesView/sampleRoutines";
import { ThemeProvider } from "../lib/theme";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

import type { ArchivedRoutinesViewProps } from "../components/ArchivedRoutinesView";
import type { RoutinesViewProps } from "../components/RoutinesView";

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

const upperLowerName = "Upper Lower";
const upperLower = sampleOtherRoutines[0];
if (upperLower === undefined) {
  throw new Error("The sample routines have no Upper Lower");
}

const listWithRoutines: RoutinesViewProps = {
  status: "ready",
  active: sampleActiveRoutine,
  others: sampleOtherRoutines,
  archivedCount: 1,
  onBack: () => undefined,
  onOpenArchived: () => undefined,
};

async function renderRoutines(props: RoutinesViewProps) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <RoutinesView {...props} />
    </ThemeProvider>,
  );
}

async function renderArchived(props: ArchivedRoutinesViewProps) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <ArchivedRoutinesView {...props} />
    </ThemeProvider>,
  );
}

// The screen has these buttons and no other: each is found by its name, and the count says nothing else is there.
function expectButtons(names: readonly string[]) {
  for (const name of names) {
    expect(screen.getByRole("button", { name })).toBeOnTheScreen();
  }
  expect(screen.queryAllByRole("button")).toHaveLength(names.length);
}

describe("the routines views", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/RoutinesView",
      "components/ArchivedRoutinesView",
      "components/RoutineCard",
      "components/RoutineRow",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  afterEach(async () => {
    await cleanup();
  });

  describe("the list, as the routines · list board draws it", () => {
    it("should title the screen Routines and go Back to Train", async () => {
      const onBack = jest.fn();
      const user = userEvent.setup();
      await renderRoutines({ ...listWithRoutines, onBack });

      expect(screen.getByRole("heading", { name: ROUTINES_SCREEN.title })).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: ROUTINES_SCREEN.backLabel }));

      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("should show the active routine under Active with its days, sets and the date it began", async () => {
      await renderRoutines(listWithRoutines);

      expect(screen.getByRole("heading", { name: ROUTINES_SCREEN.activeLabel })).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Push Pull Legs" })).toBeOnTheScreen();
      expect(screen.getByText("4 days · 63 sets a week · since Mon 21 Sep")).toBeOnTheScreen();
    });

    it("should list the other routines with their weekdays and sets", async () => {
      await renderRoutines(listWithRoutines);

      expect(
        screen.getByRole("heading", { name: ROUTINES_SCREEN.otherSectionName }),
      ).toBeOnTheScreen();
      expect(screen.getByText(upperLowerName)).toBeOnTheScreen();
      expect(screen.getByText("4 days · Mon, Tue, Thu, Fri · 60 sets a week")).toBeOnTheScreen();
      expect(screen.getByText("Full body")).toBeOnTheScreen();
      expect(screen.getByText("3 days · Mon, Wed, Fri · 45 sets a week")).toBeOnTheScreen();
    });

    it("should let a long name and its meta wrap, not cut them with an ellipsis", async () => {
      await renderRoutines(listWithRoutines);

      expect(screen.getByText(upperLowerName)).not.toHaveProp("numberOfLines");
      expect(screen.getByText("4 days · Mon, Tue, Thu, Fri · 60 sets a week")).not.toHaveProp(
        "numberOfLines",
      );
    });

    it("should link to the archived routines with how many there are, and open them", async () => {
      const onOpenArchived = jest.fn();
      const user = userEvent.setup();
      await renderRoutines({ ...listWithRoutines, onOpenArchived });

      await user.press(screen.getByRole("button", { name: describeArchivedRoutinesLink(1) }));

      expect(describeArchivedRoutinesLink(1)).toBe("Archived · 1");
      expect(onOpenArchived).toHaveBeenCalledTimes(1);
    });

    it("should draw no link to the archived routines when none are archived", async () => {
      await renderRoutines({ ...listWithRoutines, archivedCount: 0 });

      expect(screen.queryByText(/^Archived/)).not.toBeOnTheScreen();
    });

    it("should draw no control but Back and Archived when no handler is given", async () => {
      await renderRoutines(listWithRoutines);

      expectButtons([ROUTINES_SCREEN.backLabel, "Archived · 1"]);
    });

    it("should draw Make active on each other routine when onMakeActive is given, and call it with that routine", async () => {
      const onMakeActive = jest.fn();
      const user = userEvent.setup();
      await renderRoutines({ ...listWithRoutines, onMakeActive });

      expectButtons([
        ROUTINES_SCREEN.backLabel,
        "Make active, Upper Lower",
        "Make active, Full body",
        "Archived · 1",
      ]);
      await user.press(screen.getByRole("button", { name: "Make active, Upper Lower" }));

      expect(onMakeActive).toHaveBeenCalledWith({ id: upperLower.id, name: upperLowerName });
    });

    it("should make the active card and each other routine open the editor when onEditRoutine is given", async () => {
      const onEditRoutine = jest.fn();
      const user = userEvent.setup();
      await renderRoutines({ ...listWithRoutines, onEditRoutine });

      await user.press(screen.getByRole("button", { name: /^Push Pull Legs, active.*\. Edit$/ }));
      await user.press(
        screen.getByRole("button", {
          name: "Upper Lower, 4 days · Mon, Tue, Thu, Fri · 60 sets a week",
        }),
      );

      expect(onEditRoutine).toHaveBeenNthCalledWith(1, {
        id: sampleActiveRoutine.id,
        name: "Push Pull Legs",
      });
      expect(onEditRoutine).toHaveBeenNthCalledWith(2, { id: upperLower.id, name: upperLowerName });
    });

    it("should draw New routine in the header when onCreateRoutine is given", async () => {
      const onCreateRoutine = jest.fn();
      const user = userEvent.setup();
      await renderRoutines({ ...listWithRoutines, onCreateRoutine });

      await user.press(screen.getByRole("button", { name: ROUTINES_SCREEN.newRoutineLabel }));

      expect(onCreateRoutine).toHaveBeenCalledTimes(1);
    });

    it("should show only Other routines when no routine is active", async () => {
      await renderRoutines({ ...listWithRoutines, active: null });

      expect(
        screen.queryByRole("heading", { name: ROUTINES_SCREEN.activeLabel }),
      ).not.toBeOnTheScreen();
      expect(screen.getByText(upperLowerName)).toBeOnTheScreen();
    });
  });

  describe("with no routine, as the routines · empty board draws it", () => {
    const none: RoutinesViewProps = {
      ...listWithRoutines,
      active: null,
      others: [],
      archivedCount: 0,
    };

    it("should show the empty state and no section", async () => {
      await renderRoutines(none);

      expect(screen.getByRole("heading", { name: ROUTINES_EMPTY.title })).toBeOnTheScreen();
      expect(screen.getByText(ROUTINES_EMPTY.body)).toBeOnTheScreen();
      expect(
        screen.queryByRole("heading", { name: ROUTINES_SCREEN.otherSectionName }),
      ).not.toBeOnTheScreen();
    });

    it("should draw no button but Back when there is no handler", async () => {
      await renderRoutines(none);

      expectButtons([ROUTINES_SCREEN.backLabel]);
    });

    it("should draw Create routine, and no New routine in the header, when onCreateRoutine is given", async () => {
      const onCreateRoutine = jest.fn();
      const user = userEvent.setup();
      await renderRoutines({ ...none, onCreateRoutine });

      await user.press(screen.getByRole("button", { name: ROUTINES_EMPTY.action }));

      expect(onCreateRoutine).toHaveBeenCalledTimes(1);
      expect(
        screen.queryByRole("button", { name: ROUTINES_SCREEN.newRoutineLabel }),
      ).not.toBeOnTheScreen();
    });

    it("should still link to the archived routines, so one can be restored", async () => {
      await renderRoutines({ ...none, archivedCount: 2 });

      expect(screen.getByRole("button", { name: "Archived · 2" })).toBeOnTheScreen();
    });
  });

  describe("before the routines are there", () => {
    it("should keep the title and Back while loading, and show no routine", async () => {
      await renderRoutines({
        status: "loading",
        onBack: () => undefined,
        onOpenArchived: () => undefined,
      });

      expect(screen.getByRole("heading", { name: ROUTINES_SCREEN.title })).toBeOnTheScreen();
      expectButtons([ROUTINES_SCREEN.backLabel]);
      expect(screen.queryByRole("heading", { name: ROUTINES_EMPTY.title })).not.toBeOnTheScreen();
    });

    it("should announce that it is loading, as the Train home does", async () => {
      await renderRoutines({
        status: "loading",
        onBack: () => undefined,
        onOpenArchived: () => undefined,
      });

      expect(screen.getByRole("status", { name: TRAIN_LOADING_NAME })).toBeOnTheScreen();
    });

    it("should say the load failed and try again", async () => {
      const onRetry = jest.fn();
      const user = userEvent.setup();
      await renderRoutines({
        status: "error",
        onRetry,
        onBack: () => undefined,
        onOpenArchived: () => undefined,
      });

      await user.press(screen.getByRole("button", { name: "Try again" }));

      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe("the archived list, as the routines · archived board draws it", () => {
    const archived: ArchivedRoutinesViewProps = {
      status: "ready",
      routines: sampleArchivedRoutines,
      onBack: () => undefined,
    };

    it("should title the screen Archived and go Back to Routines", async () => {
      const onBack = jest.fn();
      const user = userEvent.setup();
      await renderArchived({ ...archived, onBack });

      expect(screen.getByRole("heading", { name: ROUTINES_ARCHIVED.title })).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: ROUTINES_ARCHIVED.backLabel }));

      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("should list the archived routine with its days and say what archived means", async () => {
      await renderArchived(archived);

      expect(screen.getByText("Starting strength")).toBeOnTheScreen();
      expect(
        screen.getByText(describeArchivedRoutineMeta({ dayCount: 3, archivedOn: null })),
      ).toBeOnTheScreen();
      expect(screen.getByText(ROUTINES_ARCHIVED.note)).toBeOnTheScreen();
    });

    it("should draw no Restore when no handler is given", async () => {
      await renderArchived(archived);

      expectButtons([ROUTINES_ARCHIVED.backLabel]);
    });

    it("should draw Restore, named for the routine, when onRestore is given, and call it", async () => {
      const onRestore = jest.fn();
      const user = userEvent.setup();
      await renderArchived({ ...archived, onRestore });

      await user.press(screen.getByRole("button", { name: "Restore Starting strength" }));

      expect(onRestore).toHaveBeenCalledWith({
        id: sampleArchivedRoutines[0]?.id,
        name: "Starting strength",
      });
    });

    it("should keep the title and Back while loading", async () => {
      await renderArchived({ status: "loading", onBack: () => undefined });

      expect(screen.getByRole("heading", { name: ROUTINES_ARCHIVED.title })).toBeOnTheScreen();
      expect(screen.queryByText("Starting strength")).not.toBeOnTheScreen();
      expect(screen.getByRole("status", { name: TRAIN_LOADING_NAME })).toBeOnTheScreen();
    });
  });
});
