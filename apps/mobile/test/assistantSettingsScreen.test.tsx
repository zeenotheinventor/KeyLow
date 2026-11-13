import { DELETE_FAILED_BANNER, LEGAL_URLS, SAVE_FAILED_BANNER } from "@keylow/core/copy";
import { controlHeight, touchTarget } from "@keylow/tokens";
import { act, render, screen, userEvent, within } from "@testing-library/react-native";
import { Linking } from "react-native";

import AssistantSettingsRoute from "../app/(tabs)/more/assistant";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { resolvedColor } from "./support/themeColor";

import type { PalatePreference } from "@keylow/api-client";

const preference = (
  id: string,
  kind: PalatePreference["kind"],
  label: string | null,
): PalatePreference => ({ id, kind, foodId: null, recipeId: null, label });

const BOARD_PREFERENCES = [
  preference("a", "allergy", "peanuts"),
  preference("b", "dislike", "mushrooms"),
  preference("c", "dislike", "coriander"),
];

type MutationOptions = { onSuccess?: () => void; onError?: () => void };

// What the three assistant hooks answer. The hooks are tested where they live, in `@keylow/api-client`.
const mockAssistant: {
  consent: { data: { isOn: boolean } | undefined };
  changes: { data: { count: number } | undefined };
  setConsent: {
    mutate: jest.Mock<undefined, [{ on: boolean }, MutationOptions]>;
    isPending: boolean;
  };
  deleteAll: { mutate: jest.Mock<undefined, [undefined, MutationOptions]>; isPending: boolean };
  palate: { data: PalatePreference[] | undefined };
} = {
  consent: { data: { isOn: false } },
  changes: { data: { count: 5 } },
  setConsent: {
    mutate: jest.fn<undefined, [{ on: boolean }, MutationOptions]>(),
    isPending: false,
  },
  deleteAll: { mutate: jest.fn<undefined, [undefined, MutationOptions]>(), isPending: false },
  palate: { data: BOARD_PREFERENCES },
};

jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useAssistantConsent: () => mockAssistant.consent,
  useSetAssistantConsent: () => mockAssistant.setConsent,
  useDeleteAllAssistantConversations: () => mockAssistant.deleteAll,
  useAssistantChanges: () => mockAssistant.changes,
  usePalatePreferences: () => mockAssistant.palate,
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

const FIRST_PARAGRAPH =
  "The assistant answers questions about your diary, weight, targets and training. It logs, copies and changes entries for you, builds and changes your routines, and changes your training goals, custom exercises and past workouts. Every change shows as a card with Undo.";
const SECOND_PARAGRAPH =
  "To do this, your messages and the Ki-Lo data the assistant reads are sent to Anthropic, the company that runs its AI model, as Ki-Lo's processor. Anthropic keeps them for up to 30 days. Ki-Lo keeps your conversations until you delete them.";
const DIALOG_BODY =
  "This removes every conversation with the assistant. Changes it made to your diary and recipes stay, and you can still undo them from What the assistant changed.";

async function renderSettings() {
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <ToastProvider>
        <AssistantSettingsRoute />
      </ToastProvider>
    </ThemeProvider>,
  );
  return user;
}

const switchRow = () => screen.getByRole("switch", { name: "Use the assistant" });

describe("the Assistant settings screen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/AssistantSettingsScreen"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    mockAssistant.consent = { data: { isOn: false } };
    mockAssistant.changes = { data: { count: 5 } };
    mockAssistant.palate = { data: BOARD_PREFERENCES };
    mockAssistant.setConsent = {
      mutate: jest.fn<undefined, [{ on: boolean }, MutationOptions]>(),
      isPending: false,
    };
    mockAssistant.deleteAll = {
      mutate: jest.fn<undefined, [undefined, MutationOptions]>(),
      isPending: false,
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    // `Linking.openURL` is already a mock in the React Native jest setup, so restoring it keeps its calls. Clearing drops them.
    jest.clearAllMocks();
  });

  describe("its header", () => {
    it("should be headed Assistant, with Back to More", async () => {
      const user = await renderSettings();

      expect(screen.getByRole("heading", { name: "Assistant" })).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Back to More" }));
      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should draw the sheet header the board draws: a raised, bordered back control and a centred h2 title", async () => {
      await renderSettings();

      expect(screen.getByRole("button", { name: "Back to More" })).toHaveStyle({
        height: controlHeight.md,
        width: touchTarget,
        borderWidth: 1,
      });
      expect(screen.getByRole("heading", { name: "Assistant" })).toHaveStyle({
        fontSize: 20,
        lineHeight: 26,
        textAlign: "center",
      });
    });

    it("should go to More when there is no screen to go back to", async () => {
      routerMock.canGoBack.mockReturnValue(false);
      const user = await renderSettings();

      await user.press(screen.getByRole("button", { name: "Back to More" }));

      expect(routerMock.back).not.toHaveBeenCalled();
      expect(routerMock.replace).toHaveBeenCalledWith("/(tabs)/more");
    });
  });

  describe("assistant-settings · consent, off by default", () => {
    it("should draw the switch off, with the caption for off", async () => {
      await renderSettings();

      expect(switchRow()).not.toBeChecked();
      expect(screen.getByText("Off until you turn it on.")).toBeOnTheScreen();
    });

    it("should say what it does, in the consent card's two paragraphs", async () => {
      await renderSettings();

      expect(screen.getByRole("heading", { name: "What it does" })).toBeOnTheScreen();
      expect(screen.getByText(FIRST_PARAGRAPH)).toBeOnTheScreen();
      expect(screen.getByText(SECOND_PARAGRAPH)).toBeOnTheScreen();
    });

    // The board draws the group only when on. It is shown off as well, because the consent card promises
    // conversations are kept until the person deletes them, so turning the assistant off must not hide Delete.
    it("should still offer Delete all conversations, which the board draws only when on", async () => {
      await renderSettings();

      expect(screen.getByRole("heading", { name: "Your conversations" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Delete all conversations" })).toBeOnTheScreen();
      expect(
        screen.getByText("Deleting conversations does not undo the changes in them."),
      ).toBeOnTheScreen();
    });

    it("should be headed Assistant, What it does, Your food and Your conversations, in that order", async () => {
      await renderSettings();

      const headings = screen.getAllByRole("heading");

      expect(headings).toHaveLength(4);
      expect(headings[0]).toHaveTextContent("Assistant");
      expect(headings[1]).toHaveTextContent("What it does");
      expect(headings[2]).toHaveTextContent("Your food");
      expect(headings[3]).toHaveTextContent("Your conversations");
    });
  });

  describe("assistant-settings · consent, on", () => {
    beforeEach(() => {
      mockAssistant.consent = { data: { isOn: true } };
    });

    it("should draw the switch on, with the caption for on", async () => {
      await renderSettings();

      expect(switchRow()).toBeChecked();
      expect(
        screen.getByText(
          "On. Open it from the Diary header, the Train header or Describe in Log food.",
        ),
      ).toBeOnTheScreen();
    });

    it("should keep What it does", async () => {
      await renderSettings();

      expect(screen.getByText(FIRST_PARAGRAPH)).toBeOnTheScreen();
      expect(screen.getByText(SECOND_PARAGRAPH)).toBeOnTheScreen();
    });

    it("should show Your conversations with Delete all conversations and its caption", async () => {
      await renderSettings();

      expect(screen.getByRole("heading", { name: "Your conversations" })).toBeOnTheScreen();
      expect(
        within(screen.getByLabelText("Your conversations")).getByRole("button", {
          name: "Delete all conversations",
        }),
      ).toBeOnTheScreen();
      expect(
        screen.getByText("Deleting conversations does not undo the changes in them."),
      ).toBeOnTheScreen();
    });

    it("should draw no chevron on Delete all conversations", async () => {
      await renderSettings();

      const row = screen.getByRole("button", { name: "Delete all conversations" });

      // Its drawings are its icon and chevron, and this row has neither.
      expect(
        screen.root?.queryAll((node) => node.type === "RNSVGSvgView" && isInside(node, row)),
      ).toHaveLength(0);
    });
  });

  describe("the Your food group", () => {
    const yourFood = () => within(screen.getByLabelText("Your food"));

    it("should sit between What it does and Your conversations, with the board's caption", async () => {
      await renderSettings();

      const headings = screen.getAllByRole("heading");
      expect(headings[1]).toHaveTextContent("What it does");
      expect(headings[2]).toHaveTextContent("Your food");
      expect(headings[3]).toHaveTextContent("Your conversations");
      expect(
        screen.getByText("The assistant uses these when it suggests recipes and meal plans."),
      ).toBeOnTheScreen();
    });

    it("should hold What you usually eat, then Foods to avoid with its count", async () => {
      await renderSettings();

      const [usual, avoid] = yourFood().getAllByRole("button");
      expect(usual).toHaveAccessibleName(
        "What you usually eat, Your habits, as the assistant sees them",
      );
      expect(avoid).toHaveAccessibleName("Foods to avoid, Dislikes and allergies, 3");
    });

    it("should count dislikes and allergies, and not the corrections", async () => {
      mockAssistant.palate = {
        data: [
          preference("a", "allergy", "peanuts"),
          preference("b", "not_usual", "drinks"),
          preference("c", "not_usual", null),
        ],
      };
      await renderSettings();

      expect(
        yourFood().getByRole("button", { name: "Foods to avoid, Dislikes and allergies, 1" }),
      ).toBeOnTheScreen();
    });

    it("should show no count until the list is read", async () => {
      mockAssistant.palate = { data: undefined };
      await renderSettings();

      expect(
        yourFood().getByRole("button", { name: "Foods to avoid, Dislikes and allergies" }),
      ).toBeOnTheScreen();
    });

    it("should open Foods to avoid inside this tab", async () => {
      const user = await renderSettings();

      await user.press(yourFood().getByRole("button", { name: /^Foods to avoid/ }));

      expect(routerMock.push).toHaveBeenCalledWith("/more/assistant/foods-to-avoid");
    });

    it("should open What you usually eat inside this tab", async () => {
      const user = await renderSettings();

      await user.press(yourFood().getByRole("button", { name: /^What you usually eat/ }));

      expect(routerMock.push).toHaveBeenCalledWith("/more/assistant/palate");
    });

    it("should be there when the assistant is off as well", async () => {
      mockAssistant.consent = { data: { isOn: false } };
      await renderSettings();

      expect(yourFood().getAllByRole("button")).toHaveLength(2);
    });
  });

  describe("the What the assistant changed row", () => {
    const conversations = () => within(screen.getByLabelText("Your conversations"));

    it("should be first in Your conversations, before Delete all conversations, with its count", async () => {
      await renderSettings();

      const changesRow = conversations().getByRole("button", {
        name: "What the assistant changed, 5",
      });

      expect(conversations().getAllByRole("button")).toHaveLength(2);
      expect(conversations().getAllByRole("button")[0]).toBe(changesRow);
      expect(within(changesRow).getByText("5")).toBeOnTheScreen();
    });

    it("should be there when the assistant is on as well", async () => {
      mockAssistant.consent = { data: { isOn: true } };
      await renderSettings();

      expect(
        conversations().getByRole("button", { name: "What the assistant changed, 5" }),
      ).toBeOnTheScreen();
    });

    it("should show no count until the list is read", async () => {
      mockAssistant.changes = { data: undefined };
      await renderSettings();

      expect(
        conversations().getByRole("button", { name: "What the assistant changed" }),
      ).toBeOnTheScreen();
    });

    it("should open the changes screen inside this tab when pressed", async () => {
      const user = await renderSettings();

      await user.press(
        conversations().getByRole("button", { name: /^What the assistant changed/ }),
      );

      expect(routerMock.push).toHaveBeenCalledWith("/more/assistant/changes");
    });
  });

  describe("the switch", () => {
    it("should ask to turn the assistant on, once, when it is off", async () => {
      const user = await renderSettings();

      await user.press(switchRow());

      expect(mockAssistant.setConsent.mutate).toHaveBeenCalledTimes(1);
      expect(mockAssistant.setConsent.mutate).toHaveBeenCalledWith(
        { on: true },
        expect.any(Object),
      );
    });

    it("should ask to turn the assistant off, once, when it is on", async () => {
      mockAssistant.consent = { data: { isOn: true } };
      const user = await renderSettings();

      await user.press(switchRow());

      expect(mockAssistant.setConsent.mutate).toHaveBeenCalledTimes(1);
      expect(mockAssistant.setConsent.mutate).toHaveBeenCalledWith(
        { on: false },
        expect.any(Object),
      );
    });

    it("should say it was not saved, at the top, when the change is refused", async () => {
      const user = await renderSettings();
      await user.press(switchRow());

      await act(() => {
        mockAssistant.setConsent.mutate.mock.calls[0]?.[1].onError?.();
      });

      expect(screen.getByText(SAVE_FAILED_BANNER)).toBeOnTheScreen();
      expect(switchRow()).not.toBeChecked();
    });

    it("should not respond while the choice is being saved", async () => {
      mockAssistant.setConsent.isPending = true;
      const user = await renderSettings();

      await user.press(switchRow());

      expect(switchRow()).toBeDisabled();
      expect(mockAssistant.setConsent.mutate).not.toHaveBeenCalled();
    });

    it("should be off, disabled and uncaptioned until the setting has been read", async () => {
      mockAssistant.consent = { data: undefined };
      await renderSettings();

      expect(switchRow()).not.toBeChecked();
      expect(switchRow()).toBeDisabled();
      expect(screen.queryByText("Off until you turn it on.")).not.toBeOnTheScreen();
    });
  });

  describe("the Privacy policy link", () => {
    it("should open the privacy policy in the browser, as the other legal links do", async () => {
      const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
      const user = await renderSettings();

      await user.press(screen.getByRole("link", { name: "Privacy policy" }));

      expect(openURL).toHaveBeenCalledTimes(1);
      expect(openURL).toHaveBeenCalledWith(LEGAL_URLS.privacy);
    });

    it("should stay as it is when the device has no browser", async () => {
      jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no browser"));
      const user = await renderSettings();

      await user.press(screen.getByRole("link", { name: "Privacy policy" }));

      expect(screen.getByRole("link", { name: "Privacy policy" })).toBeOnTheScreen();
    });
  });

  // The assistant is off here, as the default, because Delete all conversations is offered either way.
  describe("Delete all conversations", () => {
    const deleteRow = () => screen.getByRole("button", { name: "Delete all conversations" });
    const dialog = () => screen.queryByLabelText("Delete all conversations?");

    it("should draw the row's title in the danger colour", async () => {
      await renderSettings();

      expect(screen.getByText("Delete all conversations")).toHaveStyle({
        color: resolvedColor("dark", "danger"),
      });
    });

    it("should open no dialog until the row is pressed", async () => {
      await renderSettings();

      expect(dialog()).not.toBeOnTheScreen();
    });

    it("should ask first, with the recommended words and the two buttons", async () => {
      const user = await renderSettings();

      await user.press(deleteRow());

      const asked = within(screen.getByLabelText("Delete all conversations?"));
      expect(asked.getByRole("heading", { name: "Delete all conversations?" })).toBeOnTheScreen();
      expect(asked.getByText(DIALOG_BODY)).toBeOnTheScreen();
      expect(asked.getByRole("button", { name: "Delete" })).toBeOnTheScreen();
      expect(asked.getByRole("button", { name: "Keep them" })).toBeOnTheScreen();
      expect(mockAssistant.deleteAll.mutate).not.toHaveBeenCalled();
    });

    it("should close with no call when Keep them is pressed", async () => {
      const user = await renderSettings();
      await user.press(deleteRow());

      await user.press(screen.getByRole("button", { name: "Keep them" }));

      expect(dialog()).not.toBeOnTheScreen();
      expect(mockAssistant.deleteAll.mutate).not.toHaveBeenCalled();
    });

    it("should delete once when Delete is pressed, and close when that has worked", async () => {
      const user = await renderSettings();
      await user.press(deleteRow());

      await user.press(screen.getByRole("button", { name: "Delete" }));

      expect(mockAssistant.deleteAll.mutate).toHaveBeenCalledTimes(1);
      expect(dialog()).toBeOnTheScreen();
      const options = mockAssistant.deleteAll.mutate.mock.calls[0]?.[1];
      await act(() => {
        options?.onSuccess?.();
      });
      expect(dialog()).not.toBeOnTheScreen();
    });

    it("should close and say it was not saved when the delete fails, so the row can ask again", async () => {
      const user = await renderSettings();
      await user.press(deleteRow());
      await user.press(screen.getByRole("button", { name: "Delete" }));

      await act(() => {
        mockAssistant.deleteAll.mutate.mock.calls[0]?.[1].onError?.();
      });

      expect(dialog()).not.toBeOnTheScreen();
      expect(screen.getByText(DELETE_FAILED_BANNER)).toBeOnTheScreen();
      expect(deleteRow()).toBeOnTheScreen();
    });

    it("should show the delete as busy while it runs", async () => {
      mockAssistant.deleteAll.isPending = true;
      const user = await renderSettings();
      await user.press(deleteRow());

      await user.press(screen.getByRole("button", { busy: true }));

      expect(mockAssistant.deleteAll.mutate).not.toHaveBeenCalled();
    });
  });
});

type Instance = NonNullable<ReturnType<typeof screen.getByRole>>;

function isInside(node: Instance | null, ancestor: Instance): boolean {
  return node !== null && (node === ancestor || isInside(node.parent, ancestor));
}
