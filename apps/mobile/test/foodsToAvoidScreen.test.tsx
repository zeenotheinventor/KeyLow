import { FOODS_TO_AVOID, RETRY_LABEL, SAVE_FAILED_BANNER } from "@keylow/core/copy";
import { act, render, screen, userEvent, within } from "@testing-library/react-native";
import { TextInput } from "react-native";

import FoodsToAvoidRoute from "../app/(tabs)/more/assistant/foods-to-avoid";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

import type { PalatePreference } from "@keylow/api-client";

type Statement = { kind: "dislike" | "allergy"; label: string };
type MutationOptions = { onSuccess?: () => void; onError?: (error: Error) => void };

const PEANUTS_ID = "44444444-4444-4444-8444-444444444441";
const MUSHROOMS_ID = "44444444-4444-4444-8444-444444444442";
const CORIANDER_ID = "44444444-4444-4444-8444-444444444443";

const preference = (id: string, kind: PalatePreference["kind"], label: string | null) => ({
  id,
  kind,
  foodId: null,
  recipeId: null,
  label,
});

const BOARD_LIST: PalatePreference[] = [
  preference(PEANUTS_ID, "allergy", "peanuts"),
  preference(MUSHROOMS_ID, "dislike", "mushrooms"),
  preference(CORIANDER_ID, "dislike", "coriander"),
];

const mockPalate: {
  preferences: {
    data: PalatePreference[] | undefined;
    isError: boolean;
    refetch: jest.Mock<undefined, []>;
  };
  add: { mutate: jest.Mock<undefined, [Statement, MutationOptions]>; isPending: boolean };
  remove: { mutate: jest.Mock<undefined, [string]>; isPending: boolean };
  // What the screen asked of `useRemovePalatePreference`, so a test can fail a removal.
  removeOptions: { onError?: () => void } | undefined;
} = {
  preferences: { data: BOARD_LIST, isError: false, refetch: jest.fn<undefined, []>() },
  add: { mutate: jest.fn<undefined, [Statement, MutationOptions]>(), isPending: false },
  remove: { mutate: jest.fn<undefined, [string]>(), isPending: false },
  removeOptions: undefined,
};

// The hooks are tested where they live, in `@keylow/api-client`.
jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  usePalatePreferences: () => mockPalate.preferences,
  useAddPalatePreference: () => mockPalate.add,
  useRemovePalatePreference: (options: { onError?: () => void }) => {
    mockPalate.removeOptions = options;
    return mockPalate.remove;
  },
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

async function renderScreen() {
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <ToastProvider>
        <FoodsToAvoidRoute />
      </ToastProvider>
    </ThemeProvider>,
  );
  return user;
}

// A text input has no role in React Native, so it is found by its accessible name, as the kit's own field tests do.
const field = () => screen.getByLabelText(FOODS_TO_AVOID.fieldLabel);
const addButton = () => screen.getByRole("button", { name: "Add" });

describe("the Foods to avoid screen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/FoodsToAvoidScreen"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    mockPalate.preferences = {
      data: BOARD_LIST,
      isError: false,
      refetch: jest.fn<undefined, []>(),
    };
    mockPalate.add = {
      mutate: jest.fn<undefined, [Statement, MutationOptions]>(),
      isPending: false,
    };
    mockPalate.remove = {
      mutate: jest.fn<undefined, [string]>(),
      isPending: false,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("with two dislikes and an allergy, as the board draws it", () => {
    it("should be headed Foods to avoid, with Back to Assistant", async () => {
      const user = await renderScreen();

      expect(screen.getByRole("heading", { name: "Foods to avoid" })).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Back to Assistant" }));
      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should say what the list is for", async () => {
      await renderScreen();

      expect(
        screen.getByText(
          "The assistant leaves these out of the recipes and meal plans it suggests.",
        ),
      ).toBeOnTheScreen();
    });

    it("should draw the add card: a field, Dislike chosen beside Allergy, and Add", async () => {
      await renderScreen();

      expect(field()).toBeOnTheScreen();
      expect(screen.getByPlaceholderText("Add a food, such as peanuts")).toBeOnTheScreen();
      expect(screen.getByRole("radio", { name: "Dislike", checked: true })).toBeOnTheScreen();
      expect(screen.getByRole("radio", { name: "Allergy", checked: false })).toBeOnTheScreen();
      expect(addButton()).toBeOnTheScreen();
    });

    it("should list each food under Your list with its kind as a badge", async () => {
      await renderScreen();

      expect(screen.getByRole("heading", { name: "Your list" })).toBeOnTheScreen();
      // The kind control has the same two words, so the badges are read inside the list.
      const list = within(screen.getByLabelText("Your list"));
      expect(list.getByText("Peanuts")).toBeOnTheScreen();
      expect(list.getByText("Mushrooms")).toBeOnTheScreen();
      expect(list.getByText("Coriander")).toBeOnTheScreen();
      expect(list.getAllByText("Allergy")).toHaveLength(1);
      expect(list.getAllByText("Dislike")).toHaveLength(2);
    });

    it("should keep the order the list gives", async () => {
      await renderScreen();

      const [first, second, third] = screen.getAllByRole("button", { name: /^Remove / });
      expect(first).toHaveAccessibleName("Remove peanuts");
      expect(second).toHaveAccessibleName("Remove mushrooms");
      expect(third).toHaveAccessibleName("Remove coriander");
    });

    it("should give each row a Remove button named for its food", async () => {
      await renderScreen();

      expect(screen.getByRole("button", { name: "Remove peanuts" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Remove mushrooms" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Remove coriander" })).toBeOnTheScreen();
    });

    it("should show the allergy disclaimer", async () => {
      await renderScreen();

      expect(
        screen.getByText(
          "Allergies are matched by food name only. Ki-Lo has no allergen data, so a food can contain peanuts without saying so. Always check labels and ingredients yourself.",
        ),
      ).toBeOnTheScreen();
    });

    it("should leave out the corrections, which are not foods to avoid", async () => {
      mockPalate.preferences.data = [
        ...BOARD_LIST,
        preference("44444444-4444-4444-8444-444444444444", "not_usual", "drinks"),
        preference("44444444-4444-4444-8444-444444444445", "not_usual", null),
      ];
      await renderScreen();

      expect(screen.getAllByRole("button", { name: /^Remove / })).toHaveLength(3);
      expect(screen.queryByText("Drinks")).not.toBeOnTheScreen();
    });
  });

  describe("adding a food", () => {
    it("should add the word as a dislike when no kind is chosen", async () => {
      const user = await renderScreen();

      await user.type(field(), "olives");
      await user.press(addButton());

      expect(mockPalate.add.mutate).toHaveBeenCalledTimes(1);
      expect(mockPalate.add.mutate.mock.calls[0]?.[0]).toEqual({
        kind: "dislike",
        label: "olives",
      });
    });

    it("should add an allergy when Allergy is chosen", async () => {
      const user = await renderScreen();

      await user.type(field(), "sesame");
      await user.press(screen.getByRole("radio", { name: "Allergy" }));
      await user.press(addButton());

      expect(mockPalate.add.mutate.mock.calls[0]?.[0]).toEqual({
        kind: "allergy",
        label: "sesame",
      });
    });

    it("should clear the field once the food is added", async () => {
      mockPalate.add.mutate.mockImplementation((_statement, options) => {
        options.onSuccess?.();
      });
      const user = await renderScreen();

      await user.type(field(), "olives");
      await user.press(addButton());

      expect(field()).toHaveDisplayValue("");
    });

    it("should draw Add ready with the field empty, as the board does", async () => {
      await renderScreen();

      expect(addButton()).toBeEnabled();
    });

    it("should focus the field and send nothing when Add is pressed with the field empty", async () => {
      const focus = jest.spyOn(TextInput.prototype, "focus");
      const user = await renderScreen();

      await user.press(addButton());

      expect(mockPalate.add.mutate).not.toHaveBeenCalled();
      expect(focus).toHaveBeenCalledTimes(1);
      focus.mockRestore();
    });

    it("should send nothing for a word of spaces alone", async () => {
      const user = await renderScreen();

      await user.type(field(), "   ");
      await user.press(addButton());

      expect(mockPalate.add.mutate).not.toHaveBeenCalled();
    });

    it("should refuse a word that is already on the list, saying so at the field and keeping the word", async () => {
      const user = await renderScreen();

      await user.type(field(), "Mushrooms");
      await user.press(addButton());

      expect(screen.getByText("That is already on your list.")).toBeOnTheScreen();
      expect(field()).toHaveDisplayValue("Mushrooms");
      expect(mockPalate.add.mutate).not.toHaveBeenCalled();
    });

    it("should say an allergy is stored as an allergy when the word is added as a dislike", async () => {
      const user = await renderScreen();

      await user.type(field(), "peanuts");
      await user.press(addButton());

      expect(
        screen.getByText(
          "Peanuts is on your list as an allergy. Remove it first to add it as a dislike.",
        ),
      ).toBeOnTheScreen();
      expect(screen.queryByText("That is already on your list.")).not.toBeOnTheScreen();
      expect(mockPalate.add.mutate).not.toHaveBeenCalled();
    });

    it("should say a dislike is stored as a dislike when the word is added as an allergy", async () => {
      const user = await renderScreen();

      await user.type(field(), "mushrooms");
      await user.press(screen.getByRole("radio", { name: "Allergy" }));
      await user.press(addButton());

      expect(
        screen.getByText(
          "Mushrooms is on your list as a dislike. Remove it first to add it as an allergy.",
        ),
      ).toBeOnTheScreen();
      expect(mockPalate.add.mutate).not.toHaveBeenCalled();
    });

    it("should refuse a word the database says is already there, which the list had not shown yet", async () => {
      mockPalate.add.mutate.mockImplementation((_statement, options) => {
        options.onError?.(
          new Error("Could not add to your palate (23505)", { cause: { code: "23505" } }),
        );
      });
      const user = await renderScreen();

      await user.type(field(), "olives");
      await user.press(addButton());

      expect(screen.getByText("That is already on your list.")).toBeOnTheScreen();
      expect(field()).toHaveDisplayValue("olives");
    });

    it("should take the refusal away when the word is changed", async () => {
      const user = await renderScreen();

      await user.type(field(), "peanuts");
      await user.press(addButton());
      await user.type(field(), "s");

      expect(screen.queryByText("That is already on your list.")).not.toBeOnTheScreen();
    });

    it("should take the refusal away when the kind is changed", async () => {
      const user = await renderScreen();

      await user.type(field(), "peanuts");
      await user.press(addButton());
      await user.press(screen.getByRole("radio", { name: "Allergy" }));

      expect(screen.queryByText("That is already on your list.")).not.toBeOnTheScreen();
    });

    it("should take the refusal away once a word is added", async () => {
      mockPalate.add.mutate.mockImplementationOnce((_statement, options) => {
        options.onError?.(
          new Error("Could not add to your palate (23505)", { cause: { code: "23505" } }),
        );
      });
      mockPalate.add.mutate.mockImplementationOnce((_statement, options) => {
        options.onSuccess?.();
      });
      const user = await renderScreen();

      await user.type(field(), "olives");
      await user.press(addButton());
      await user.press(addButton());

      expect(screen.queryByText("That is already on your list.")).not.toBeOnTheScreen();
    });

    it("should say Not saved in a toast when the add fails for any other reason, and keep the word", async () => {
      mockPalate.add.mutate.mockImplementation((_statement, options) => {
        options.onError?.(
          new Error("Could not add to your palate (no code)", { cause: { code: undefined } }),
        );
      });
      const user = await renderScreen();

      await user.type(field(), "olives");
      await user.press(addButton());

      expect(await screen.findByText(SAVE_FAILED_BANNER)).toBeOnTheScreen();
      expect(field()).toHaveDisplayValue("olives");
    });

    it("should hold Add while an add is on its way", async () => {
      mockPalate.add.isPending = true;
      const user = await renderScreen();

      await user.type(field(), "olives");
      await user.press(addButton());

      expect(mockPalate.add.mutate).not.toHaveBeenCalled();
    });
  });

  describe("removing a food", () => {
    it("should remove the row by its id", async () => {
      const user = await renderScreen();

      await user.press(screen.getByRole("button", { name: "Remove mushrooms" }));

      expect(mockPalate.remove.mutate).toHaveBeenCalledTimes(1);
      expect(mockPalate.remove.mutate.mock.calls[0]?.[0]).toBe(MUSHROOMS_ID);
    });

    it("should say Not removed in a toast for every failed removal, not only the latest", async () => {
      const user = await renderScreen();
      await user.press(screen.getByRole("button", { name: "Remove mushrooms" }));
      await user.press(screen.getByRole("button", { name: "Remove coriander" }));

      await act(() => {
        mockPalate.removeOptions?.onError?.();
        mockPalate.removeOptions?.onError?.();
      });

      expect(await screen.findAllByText(FOODS_TO_AVOID.removeFailed)).not.toHaveLength(0);
    });
  });

  describe("with nothing on the list", () => {
    beforeEach(() => {
      mockPalate.preferences.data = [];
    });

    it("should draw the empty state, with the add card and the disclaimer still there", async () => {
      await renderScreen();

      expect(screen.getByText("Nothing on your list yet")).toBeOnTheScreen();
      expect(
        screen.getByText(
          "Add a food above and the assistant will leave it out of the recipes and meal plans it suggests.",
        ),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: "Your list" })).not.toBeOnTheScreen();
      expect(addButton()).toBeOnTheScreen();
      expect(screen.getByText(/Allergies are matched by food name only/)).toBeOnTheScreen();
    });
  });

  describe("while the list is being read", () => {
    it("should draw a loading status with no list, no empty state and no add card", async () => {
      mockPalate.preferences.data = undefined;
      await renderScreen();

      expect(screen.getByRole("status")).toBeOnTheScreen();
      expect(screen.queryByText("Nothing on your list yet")).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Add" })).not.toBeOnTheScreen();
    });
  });

  describe("when a refresh fails behind a list that was read", () => {
    it("should keep the list on the screen, with a food that was just added", async () => {
      mockPalate.preferences.isError = true;
      await renderScreen();

      expect(screen.getByText("Peanuts")).toBeOnTheScreen();
      expect(screen.queryByText("Couldn't load your list")).not.toBeOnTheScreen();
    });
  });

  describe("when the list cannot be read", () => {
    it("should say so, with Try again, and read the list again on Try again", async () => {
      mockPalate.preferences.data = undefined;
      mockPalate.preferences.isError = true;
      const user = await renderScreen();

      expect(screen.getByText("Couldn't load your list")).toBeOnTheScreen();
      expect(screen.getByText("Check your connection and try again.")).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: RETRY_LABEL }));
      expect(mockPalate.preferences.refetch).toHaveBeenCalledTimes(1);
    });
  });
});
