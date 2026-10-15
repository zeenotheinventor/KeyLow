import { KeyLowProvider } from "@keylow/api-client";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent } from "@testing-library/react-native";

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
import { registerAppStyles } from "./support/nativeWindStyles";

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
    });

    it("should offer Try again when the targets cannot be read", async () => {
      const user = userEvent.setup();
      diaryBackend.targetsReadFails = true;
      await renderTargets();
      await screen.findByText("Something went wrong. Try again.");

      diaryBackend.targetsReadFails = false;
      await user.press(screen.getByRole("button", { name: "Try again" }));

      expect(await screen.findByLabelText("Calories (kcal)")).toHaveDisplayValue("2200");
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
