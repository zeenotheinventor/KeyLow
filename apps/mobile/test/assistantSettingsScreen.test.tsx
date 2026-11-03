import { LEGAL_URLS, SAVE_FAILED_BANNER } from "@keylow/core/copy";
import { act, render, screen, userEvent, within } from "@testing-library/react-native";
import { Linking } from "react-native";

import AssistantSettingsRoute from "../app/(tabs)/more/assistant";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";

type MutationOptions = { onSuccess?: () => void; onError?: () => void };

// What the three assistant hooks answer. The hooks are tested where they live, in `@keylow/api-client`.
const mockAssistant: {
  consent: { data: { isOn: boolean } | undefined };
  setConsent: {
    mutate: jest.Mock<undefined, [{ on: boolean }, MutationOptions]>;
    isPending: boolean;
  };
  deleteAll: { mutate: jest.Mock<undefined, [undefined, MutationOptions]>; isPending: boolean };
} = {
  consent: { data: { isOn: false } },
  setConsent: {
    mutate: jest.fn<undefined, [{ on: boolean }, MutationOptions]>(),
    isPending: false,
  },
  deleteAll: { mutate: jest.fn<undefined, [undefined, MutationOptions]>(), isPending: false },
};

jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useAssistantConsent: () => mockAssistant.consent,
  useSetAssistantConsent: () => mockAssistant.setConsent,
  useDeleteAllAssistantConversations: () => mockAssistant.deleteAll,
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
  "The assistant answers questions about your diary, weight and targets, and logs, copies and changes entries for you. Every change shows as a card with Undo.";
const SECOND_PARAGRAPH =
  "To do this, your messages and the Ki-Lo data the assistant reads are sent to Anthropic, the company that runs its AI model, as Ki-Lo's processor. Anthropic keeps them for up to 30 days. Ki-Lo keeps your conversations until you delete them.";
const DIALOG_BODY =
  "This removes every conversation with the assistant. Changes it made to your diary and recipes stay, and you can still undo them from What the assistant changed.";

async function renderSettings() {
  const user = userEvent.setup();
  await render(
    <ThemeProvider>
      <ToastProvider>
        <AssistantSettingsRoute />
      </ToastProvider>
    </ThemeProvider>,
  );
  return user;
}

const switchRow = () => screen.getByRole("switch", { name: "Use the assistant" });

describe("the Assistant settings screen", () => {
  beforeEach(() => {
    resetRouterMock();
    mockAssistant.consent = { data: { isOn: false } };
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

    it("should have no conversations group and no Delete all conversations row", async () => {
      await renderSettings();

      expect(screen.queryByRole("heading", { name: "Your conversations" })).not.toBeOnTheScreen();
      expect(
        screen.queryByRole("button", { name: "Delete all conversations" }),
      ).not.toBeOnTheScreen();
      expect(
        screen.queryByText("Deleting conversations does not undo the changes in them."),
      ).not.toBeOnTheScreen();
    });

    it("should be headed What it does and Assistant alone", async () => {
      await renderSettings();

      const headings = screen.getAllByRole("heading");

      expect(headings).toHaveLength(2);
      expect(headings[0]).toHaveTextContent("Assistant");
      expect(headings[1]).toHaveTextContent("What it does");
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
        screen.getByText("On. Open it from the Diary header or Describe in Log food."),
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

    it("should not offer What the assistant changed, which Assistant mobile 10 adds with its screen", async () => {
      await renderSettings();

      expect(screen.queryByText("What the assistant changed")).not.toBeOnTheScreen();
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

  describe("Delete all conversations", () => {
    beforeEach(() => {
      mockAssistant.consent = { data: { isOn: true } };
    });

    const deleteRow = () => screen.getByRole("button", { name: "Delete all conversations" });
    const dialog = () => screen.queryByLabelText("Delete all conversations?");

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
      expect(screen.getByText(SAVE_FAILED_BANNER)).toBeOnTheScreen();
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
