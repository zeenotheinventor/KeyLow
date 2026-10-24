import { KeyLowProvider, keys } from "@keylow/api-client";
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

import { TargetsScreen } from "../components/TargetsScreen";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import {
  createDiaryQueryClient,
  diaryBackend,
  diaryClient,
  noTargets,
  requestsTo,
  resetDiaryBackend,
  signInDiaryClient,
} from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { expectAccessibleNamesInOrder } from "./support/namesInOrder";
import { registerAppStyles } from "./support/nativeWindStyles";
import { pressTwiceInTheSameMoment } from "./support/sameTickPress";

import type { QueryClient } from "@tanstack/react-query";

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

let queryClient: QueryClient;

async function renderTargets() {
  queryClient = createDiaryQueryClient();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        <ToastProvider>
          <TargetsScreen />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

async function renderLoadedTargets() {
  await renderTargets();
  await screen.findByLabelText("Calories (kcal)");
}

const calories = () => screen.getByLabelText("Calories (kcal)");
const protein = () => screen.getByLabelText("Protein target in grams");
const carbs = () => screen.getByLabelText("Carbohydrate target in grams");
const fat = () => screen.getByLabelText("Fat target in grams");
const save = () => screen.getByRole("button", { name: "Save" });

describe("the Targets screen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/TargetsScreen"]);
  });

  beforeEach(async () => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    await signInDiaryClient();
    // The sign in asked the fake server who the user is, which is not what the tests count.
    diaryBackend.requests = [];
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  describe("with no target set", () => {
    beforeEach(() => {
      diaryBackend.targets = noTargets;
    });

    it("should be titled Targets with a Back button, over Calories and three macro fields", async () => {
      await renderLoadedTargets();

      expect(screen.getByRole("heading", { name: "Targets" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Back" })).toBeOnTheScreen();
      expect(protein()).toBeOnTheScreen();
      expect(carbs()).toBeOnTheScreen();
      expect(fat()).toBeOnTheScreen();
    });

    it("should leave every field empty and Save disabled", async () => {
      await renderLoadedTargets();

      for (const field of [calories(), protein(), carbs(), fat()]) {
        expect(field).toHaveDisplayValue("");
      }
      expect(save()).toBeDisabled();
    });

    it("should say the range under Calories, that macros are optional, and the note", async () => {
      await renderLoadedTargets();

      expect(screen.getByText("Between 800 and 6,000 kcal")).toBeOnTheScreen();
      expect(screen.getByText("Macros are optional")).toBeOnTheScreen();
      expect(
        screen.getByText(
          "You set these yourself for now. Later, Ki-Lo will suggest targets from your weight trend.",
        ),
      ).toBeOnTheScreen();
    });

    it("should show no error before anything is typed", async () => {
      await renderLoadedTargets();

      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });
  });

  describe("with targets set", () => {
    it("should fill the fields with the stored targets and enable Save", async () => {
      await renderLoadedTargets();

      expect(calories()).toHaveDisplayValue("2200");
      expect(protein()).toHaveDisplayValue("160");
      expect(carbs()).toHaveDisplayValue("220");
      expect(fat()).toHaveDisplayValue("70");
      expect(save()).toBeEnabled();
    });

    it("should say what the macros add up to", async () => {
      await renderLoadedTargets();

      expect(screen.getByText("Macros add up to 2,150 kcal")).toBeOnTheScreen();
    });

    it("should update the sum as a macro is typed", async () => {
      const user = userEvent.setup();
      await renderLoadedTargets();

      await user.clear(fat());
      await user.type(fat(), "80");

      expect(screen.getByText("Macros add up to 2,240 kcal")).toBeOnTheScreen();
    });

    it("should go back to Macros are optional when every macro is cleared", async () => {
      const user = userEvent.setup();
      await renderLoadedTargets();

      await user.clear(protein());
      await user.clear(carbs());
      await user.clear(fat());

      expect(screen.getByText("Macros are optional")).toBeOnTheScreen();
      expect(save()).toBeEnabled();
    });
  });

  describe("calories that are not allowed", () => {
    it("should say the range and disable Save for a number above 6,000", async () => {
      const user = userEvent.setup();
      await renderLoadedTargets();

      await user.clear(calories());
      await user.type(calories(), "7500");

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Enter a target between 800 and 6,000 kcal.",
      );
      expect(save()).toBeDisabled();
    });

    it.each([
      ["799", true],
      ["800", false],
      ["6000", false],
      ["6001", true],
    ])("should treat %s as out of range: %s", async (value, isOutOfRange) => {
      const user = userEvent.setup();
      await renderLoadedTargets();

      await user.clear(calories());
      await user.type(calories(), value);

      if (isOutOfRange) {
        expect(save()).toBeDisabled();
        expect(screen.getByRole("alert")).toBeOnTheScreen();
      } else {
        expect(save()).toBeEnabled();
        expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
      }
    });

    it.each(["2200.5", "2200,5"])(
      "should ask for whole calories for %s, and disable Save",
      async (value) => {
        const user = userEvent.setup();
        await renderLoadedTargets();

        await user.clear(calories());
        await user.type(calories(), value);

        expect(screen.getByRole("alert")).toHaveTextContent("Enter whole calories.");
        expect(save()).toBeDisabled();
      },
    );

    it("should refuse 1,200 calories, which is not 1.2, and write nothing", async () => {
      const user = userEvent.setup();
      await renderLoadedTargets();

      await user.clear(calories());
      await user.type(calories(), "1,200");
      await user.press(save());

      expect(save()).toBeDisabled();
      expect(diaryBackend.saves).toHaveLength(0);
    });

    it("should refuse 1,200 in a macro, and write nothing", async () => {
      const user = userEvent.setup();
      await renderLoadedTargets();

      await user.clear(protein());
      await user.type(protein(), "1,200");
      await user.press(save());

      expect(save()).toBeDisabled();
      expect(diaryBackend.saves).toHaveLength(0);
    });

    it("should never write NaN in the macro sum while a macro is not a number", async () => {
      const user = userEvent.setup();
      await renderLoadedTargets();

      await user.clear(protein());
      await user.type(protein(), "1,200");

      expect(screen.queryByText(/NaN/)).not.toBeOnTheScreen();
      expect(screen.getByText("Macros add up to 1,510 kcal")).toBeOnTheScreen();
    });

    it("should ask for calories when the field is cleared, and disable Save", async () => {
      const user = userEvent.setup();
      await renderLoadedTargets();

      await user.clear(calories());

      expect(screen.getByRole("alert")).toHaveTextContent("Enter a calorie target.");
      expect(save()).toBeDisabled();
    });
  });

  describe("saving", () => {
    it("should write the four targets, go back and say Targets saved", async () => {
      const user = userEvent.setup();
      await renderLoadedTargets();
      await user.clear(calories());
      await user.type(calories(), "2400");

      await user.press(save());

      expect(await screen.findByRole("status")).toHaveTextContent("Targets saved");
      expect(routerMock.back).toHaveBeenCalledTimes(1);
      expect(diaryBackend.saves).toHaveLength(1);
      expect(diaryBackend.saves[0]).toMatchObject({
        target_kcal: 2400,
        target_protein_g: 160,
        target_carbs_g: 220,
        target_fat_g: 70,
      });
    });

    it("should save blank macros as no target", async () => {
      const user = userEvent.setup();
      await renderLoadedTargets();
      await user.clear(protein());
      await user.clear(carbs());
      await user.clear(fat());

      await user.press(save());

      await screen.findByRole("status");
      expect(diaryBackend.saves[0]).toMatchObject({
        target_kcal: 2200,
        target_protein_g: null,
        target_carbs_g: null,
        target_fat_g: null,
      });
    });

    it("should go to More when there is nothing to go back to", async () => {
      const user = userEvent.setup();
      routerMock.canGoBack.mockReturnValue(false);
      await renderLoadedTargets();

      await user.press(save());

      await screen.findByRole("status");
      expect(routerMock.back).not.toHaveBeenCalled();
      expect(routerMock.replace).toHaveBeenCalledWith("/(tabs)/more");
    });

    it("should stay on the screen with the sentence, and no toast, when the save fails", async () => {
      const user = userEvent.setup();
      await renderLoadedTargets();
      diaryBackend.failingTables.add("profiles");

      await user.press(save());

      expect(
        await screen.findByText("Not saved. Check your connection and try again."),
      ).toBeOnTheScreen();
      expect(routerMock.back).not.toHaveBeenCalled();
      expect(screen.queryByRole("status")).not.toBeOnTheScreen();
      expect(calories()).toHaveDisplayValue("2200");
      expect(screen.queryByText(/raw database text/)).not.toBeOnTheScreen();
    });

    it("should go back on the Back button without saving", async () => {
      const user = userEvent.setup();
      await renderLoadedTargets();

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
      expect(diaryBackend.saves).toEqual([]);
    });
  });

  describe("the Estimate my targets row", () => {
    const estimateRow = () =>
      screen.getByRole("button", {
        name: "Estimate my targets, From a few questions about you and your goal",
      });

    it("should come before the Calories field and Save in reading order, after Back", async () => {
      await renderLoadedTargets();

      expectAccessibleNamesInOrder(
        screen.getAllByRole("button").filter((button) => button.props.role === "button"),
        ["Back", "Estimate my targets, From a few questions about you and your goal", "Save"],
      );
      expectAccessibleNamesInOrder(screen.getAllByLabelText(/^(Estimate my targets|Calories)/), [
        "Estimate my targets, From a few questions about you and your goal",
        "Calories (kcal)",
      ]);
    });

    it("should scroll with the fields, as the board draws it", async () => {
      await renderLoadedTargets();

      const scrollView = screen.root?.queryAll((node) => node.type === "RCTScrollView")[0];

      if (scrollView === undefined) {
        throw new Error("The form has no scroll view");
      }
      expect(
        within(scrollView).getByRole("button", {
          name: "Estimate my targets, From a few questions about you and your goal",
        }),
      ).toBeOnTheScreen();
      expect(within(scrollView).getByLabelText("Calories (kcal)")).toBeOnTheScreen();
    });

    it("should say what it does under its title", async () => {
      await renderLoadedTargets();

      expect(screen.getByText("Estimate my targets")).toBeOnTheScreen();
      expect(screen.getByText("From a few questions about you and your goal")).toBeOnTheScreen();
    });

    it("should be there when no target is set yet", async () => {
      diaryBackend.targets = noTargets;

      await renderLoadedTargets();

      expect(estimateRow()).toBeOnTheScreen();
    });

    it("should open the wizard in recalculate mode", async () => {
      const user = userEvent.setup();
      await renderLoadedTargets();

      await user.press(estimateRow());

      expect(routerMock.push).toHaveBeenCalledTimes(1);
      expect(routerMock.push).toHaveBeenCalledWith("/setup?mode=recalculate");
    });

    it("should open the wizard once when it is pressed twice before the screen has moved", async () => {
      await renderLoadedTargets();

      await pressTwiceInTheSameMoment(estimateRow());

      expect(routerMock.push).toHaveBeenCalledTimes(1);
    });

    it("should leave the fields as they were", async () => {
      await renderLoadedTargets();

      expect(calories()).toHaveDisplayValue("2200");
      expect(save()).toBeEnabled();
    });
  });

  describe("when the stored targets change under the screen", () => {
    // What a recalculation does: the wizard saves over this screen, which stays mounted under it, and the
    // targets are read again.
    async function refetchTargets() {
      await act(() => queryClient.invalidateQueries({ queryKey: keys.profiles.targets }));
    }

    it("should show the new numbers in the fields, so a Save does not write the old ones back", async () => {
      await renderLoadedTargets();
      expect(calories()).toHaveDisplayValue("2200");
      diaryBackend.targets = { ...diaryBackend.targets, target_kcal: 1970 };

      await refetchTargets();

      await waitFor(() => {
        expect(calories()).toHaveDisplayValue("1970");
      });
      expect(protein()).toHaveDisplayValue("160");
    });

    it("should keep what is typed when the targets are read again with the same numbers", async () => {
      const user = userEvent.setup();
      await renderLoadedTargets();
      await user.clear(calories());
      await user.type(calories(), "2400");
      const readsBefore = requestsTo("profiles");

      await refetchTargets();

      await waitFor(() => {
        expect(requestsTo("profiles")).toBeGreaterThan(readsBefore);
      });
      expect(calories()).toHaveDisplayValue("2400");
    });
  });

  describe("offline", () => {
    it("should say so and disable Save", async () => {
      await renderLoadedTargets();

      await act(() => {
        onlineManager.setOnline(false);
      });

      expect(screen.getByText("You're offline")).toBeOnTheScreen();
      expect(save()).toBeDisabled();
    });
  });

  describe("loading and failing", () => {
    it("should show no fields while the targets load", async () => {
      diaryBackend.hungTables.add("profiles");
      await renderTargets();

      expect(screen.getByRole("heading", { name: "Targets" })).toBeOnTheScreen();
      expect(screen.queryByLabelText("Calories (kcal)")).not.toBeOnTheScreen();
      expect(
        screen.queryByRole("button", {
          name: "Estimate my targets, From a few questions about you and your goal",
        }),
      ).not.toBeOnTheScreen();
    });

    it("should offer Try again when the targets cannot be read", async () => {
      const user = userEvent.setup();
      diaryBackend.targetsReadFails = true;
      await renderTargets();
      await screen.findByText("Something went wrong. Try again.");
      expect(
        screen.queryByRole("button", {
          name: "Estimate my targets, From a few questions about you and your goal",
        }),
      ).not.toBeOnTheScreen();

      diaryBackend.targetsReadFails = false;
      await user.press(screen.getByRole("button", { name: "Try again" }));

      expect(await screen.findByLabelText("Calories (kcal)")).toHaveDisplayValue("2200");
    });
  });

  describe("a user with no programme", () => {
    it("should see none of the programme's words, and the manual note and card", async () => {
      await renderLoadedTargets();

      expect(
        screen.queryByRole("button", {
          name: "Programme, Your weekly check-in sets these targets",
        }),
      ).not.toBeOnTheScreen();
      expect(screen.queryByText("This week")).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Set my own targets" })).not.toBeOnTheScreen();
      expect(
        screen.queryByText("Saving your own targets ends your programme and its weekly check-in."),
      ).not.toBeOnTheScreen();
      expect(
        screen.getByText(
          "You set these yourself for now. Later, Ki-Lo will suggest targets from your weight trend.",
        ),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole("button", {
          name: "Estimate my targets, From a few questions about you and your goal",
        }),
      ).toBeOnTheScreen();
    });

    it("should save again when Save is pressed again after a failed save", async () => {
      const user = userEvent.setup();
      await renderLoadedTargets();
      diaryBackend.failingTables.add("profiles");
      await user.press(save());
      await screen.findByText("Not saved. Check your connection and try again.");
      diaryBackend.failingTables.delete("profiles");

      await user.press(save());

      expect(await screen.findByRole("status")).toHaveTextContent("Targets saved");
      expect(diaryBackend.saves).toHaveLength(1);
      // The save starts by looking for a programme to end, so each attempt makes this read once.
      expect(
        diaryBackend.requests.filter(
          (request) =>
            request.table === "programs" && request.search.includes("select=id%2Cstarted_on"),
        ),
      ).toHaveLength(2);
    });

    it("should make no read of the programme summary", async () => {
      await renderLoadedTargets();

      expect(requestsTo("expenditure_snapshots")).toBe(0);
    });

    it("should save without asking, and never show the dialog", async () => {
      const user = userEvent.setup();
      await renderLoadedTargets();

      await user.press(save());

      expect(
        screen.queryByRole("heading", { name: "Turn off weekly check-ins?" }),
      ).not.toBeOnTheScreen();
      expect(await screen.findByRole("status")).toHaveTextContent("Targets saved");
      expect(diaryBackend.saves).toHaveLength(1);
    });
  });

  describe("the terms gate", () => {
    it("should read no targets while the terms are not accepted", async () => {
      diaryBackend.terms = { terms_accepted_at: null, terms_version: null };
      await renderTargets();
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(
        diaryBackend.requests.filter((request) => !request.search.includes("terms_accepted_at")),
      ).toEqual([]);
      expect(requestsTo("profiles")).toBe(1);
      expect(screen.queryByLabelText("Calories (kcal)")).not.toBeOnTheScreen();
    });
  });
});
