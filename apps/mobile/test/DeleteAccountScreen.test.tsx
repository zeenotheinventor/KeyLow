import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  userEvent,
  within,
} from "@testing-library/react-native";
import { BackHandler, Linking } from "react-native";

import DeleteAccountRoute from "../app/(tabs)/more/delete-account";
import { ThemeProvider } from "../lib/theme";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { installVirtualClock } from "./support/virtualClock";

import type { DeleteAccountOnDeviceResult } from "../lib/accountDeletion/types";

// What the deletion answers. The hook is KEY-1123's and is tested where it lives, so it is mocked at its module
// boundary with the same mutation settings, which keeps React Query's own pending and callback behaviour.
const mockDeleteAccount = jest.fn<Promise<DeleteAccountOnDeviceResult>, []>();

jest.mock("../lib/accountDeletion/useDeleteAccountOnDevice", () => ({
  useDeleteAccountOnDevice: () =>
    jest
      .requireActual<typeof import("@tanstack/react-query")>("@tanstack/react-query")
      .useMutation({
        mutationFn: () => mockDeleteAccount(),
        retry: false,
        networkMode: "always",
      }),
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

// Words of the boards `delete-account · explain` to `unconfirmed`, written out again here so a change to the
// copy file is seen by this test.
const WORDS = {
  cardTitle: "What Ki-Lo deletes",
  cardItems: [
    "Your diary",
    "Your own foods and recipes",
    "Your weight and body measurements",
    "Your programme and targets",
    "Your training",
    "Your assistant conversations",
    "Your achievements",
    "What Ki-Lo keeps on this phone",
  ],
  cardCaption:
    "Error reports and what the assistant sent to Anthropic can stay with those services for up to 30 days.",
  permanence: "Your account is deleted at once. This cannot be undone.",
  offlineTitle: "You're offline",
  offlineBody: "Deleting your account needs a connection.",
  dialogTitle: "Delete your account?",
  dialogBody: "Everything in your account is deleted now. This cannot be undone.",
  deletingTitle: "Deleting your account",
  deletingBody: "This can take a moment. Keep Ki-Lo open.",
  failedTitle: "Your account was not deleted",
  failedBody: "Nothing was removed. Try again or use email.",
  unconfirmedTitle: "Ki-Lo could not confirm the deletion",
  unconfirmedBody: "Your account may already be deleted. Check your connection and try again.",
};

// The handlers registered for the Android back button. The last one registered is asked first.
const backPressHandlers: Parameters<typeof BackHandler.addEventListener>[1][] = [];

async function pressAndroidBackButton(): Promise<boolean> {
  let wasHandled = false;
  await act(() => {
    for (const handler of [...backPressHandlers].reverse()) {
      if (handler({ type: "hardwareBackPress", timeStamp: 0 }) === true) {
        wasHandled = true;
        return;
      }
    }
  });
  return wasHandled;
}

// The deletion held by a promise the test settles, so the state while it runs can be looked at.
function holdTheDeletion() {
  let settle: (result: DeleteAccountOnDeviceResult) => void = () => undefined;
  mockDeleteAccount.mockImplementationOnce(
    () =>
      new Promise<DeleteAccountOnDeviceResult>((resolve) => {
        settle = resolve;
      }),
  );
  return (result: DeleteAccountOnDeviceResult) =>
    // React Query tells the screen on a timer, so the fake clock moves on for it to land.
    act(async () => {
      settle(result);
      await jest.advanceTimersByTimeAsync(10);
    });
}

function renderScreen() {
  return render(
    <ThemeProvider fixedPreference="dark">
      <QueryClientProvider client={new QueryClient()}>
        <DeleteAccountRoute />
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

// The dialog is not one accessible element, or its buttons would be unreachable, so it is found by its name. The
// busy button carries the deleting title as its name too, so the dialog is the one with the alert dialog role.
function dialogNamed(name: string) {
  const [named] = screen
    .getAllByLabelText(name)
    .filter((element) => element.props.role === "alertdialog");
  if (named === undefined) {
    throw new Error(`No alert dialog is named ${name}`);
  }
  return named;
}

const dialog = () => dialogNamed(WORDS.dialogTitle);
const deletingDialog = () => dialogNamed(WORDS.deletingTitle);

// The dim behind the dialog is a pressable that a screen reader never reaches, so it is the one button that
// only shows up when the hidden are included.
function dim() {
  const reachable = screen.getAllByRole("button");
  const hidden = screen
    .getAllByRole("button", { includeHiddenElements: true })
    .filter((button) => !reachable.includes(button));
  const [onlyButton] = hidden;
  if (hidden.length !== 1 || onlyButton === undefined) {
    throw new Error(`Expected one hidden button, the dim, and found ${hidden.length}`);
  }
  return onlyButton;
}

// The Delete account button of the screen, not the dialog's, which comes after it in the same tree.
function screenDeleteButton() {
  const [screenButton] = screen.getAllByRole("button", { name: "Delete account" });
  if (screenButton === undefined) {
    throw new Error("The screen's Delete account button is not drawn");
  }
  return screenButton;
}

// The header's Back and the footer's Back to More share a name, and the header comes first.
function backButtons() {
  const [header, footer] = screen.getAllByRole("button", { name: "Back to More" });
  if (header === undefined || footer === undefined) {
    throw new Error("Expected both the header's Back and the footer's Back to More");
  }
  return { header, footer };
}

// Every piece of text is checked to be drawn in this order, top to bottom.
function expectInOrder(texts: readonly string[]) {
  const drawn = JSON.stringify(screen.toJSON());
  const positions = texts.map((text) => drawn.indexOf(text));
  expect(positions.every((position) => position > -1)).toBe(true);
  expect(positions).toEqual([...positions].sort((first, second) => first - second));
}

// Opens the confirm, presses its Delete account and settles the deletion with `result`.
async function deleteAndAnswer(result: DeleteAccountOnDeviceResult) {
  const user = userEvent.setup();
  mockDeleteAccount.mockResolvedValueOnce(result);
  await user.press(screenDeleteButton());
  await user.press(within(dialog()).getByRole("button", { name: "Delete account" }));
}

describe("the Delete account screen", () => {
  beforeEach(() => {
    installVirtualClock();
    resetRouterMock();
    mockDeleteAccount.mockReset();
    onlineManager.setOnline(true);
    backPressHandlers.length = 0;
    jest.spyOn(BackHandler, "addEventListener").mockImplementation((_eventName, handler) => {
      backPressHandlers.push(handler);
      return {
        remove: () => {
          backPressHandlers.splice(backPressHandlers.indexOf(handler), 1);
        },
      };
    });
  });

  afterEach(async () => {
    await act(() => {
      onlineManager.setOnline(true);
    });
    // Unmounting drops the mutation, and its five minute cache timer must be set on the fake clock, or it keeps the run open.
    await cleanup();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe("delete-account · explain", () => {
    it("should be headed Delete account, with a Back to More button", async () => {
      await renderScreen();

      expect(screen.getByRole("heading", { name: "Delete account" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Back to More" })).toBeOnTheScreen();
    });

    it("should list the eight areas Ki-Lo deletes under the card heading, then the caption about the 30 days", async () => {
      await renderScreen();

      expect(screen.getByRole("heading", { name: WORDS.cardTitle })).toBeOnTheScreen();
      expectInOrder([WORDS.cardTitle, ...WORDS.cardItems, WORDS.cardCaption]);
      expect(screen.getByText(WORDS.cardCaption)).toBeOnTheScreen();
    });

    it("should warn that it is permanent as a note, not an alert", async () => {
      await renderScreen();

      expect(screen.getByRole("note")).toHaveTextContent(WORDS.permanence);
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });

    it("should offer Export my data with Save a copy first, and open it when pressed", async () => {
      const user = userEvent.setup();
      await renderScreen();

      await user.press(screen.getByRole("button", { name: "Export my data, Save a copy first" }));

      expect(routerMock.push).toHaveBeenCalledWith("/more/export");
    });

    it("should end in the two fixed buttons, Delete account and Keep my account", async () => {
      await renderScreen();

      expect(screen.getByRole("button", { name: "Delete account" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Keep my account" })).toBeEnabled();
    });

    it("should go back to More from the header Back and from Keep my account, and delete nothing", async () => {
      const user = userEvent.setup();
      await renderScreen();

      await user.press(screen.getByRole("button", { name: "Back to More" }));
      await user.press(screen.getByRole("button", { name: "Keep my account" }));

      expect(routerMock.back).toHaveBeenCalledTimes(2);
      expect(mockDeleteAccount).not.toHaveBeenCalled();
    });

    it("should go to More when there is nothing to go back to, as a cold link has not", async () => {
      routerMock.canGoBack.mockReturnValue(false);
      const user = userEvent.setup();
      await renderScreen();

      await user.press(screen.getByRole("button", { name: "Keep my account" }));

      expect(routerMock.replace).toHaveBeenCalledWith("/(tabs)/more");
    });

    it("should leave the Android back button to the stack, which returns to More", async () => {
      await renderScreen();

      expect(await pressAndroidBackButton()).toBe(false);
    });

    it("should open the confirm when Delete account is pressed, and delete nothing by itself", async () => {
      const user = userEvent.setup();
      await renderScreen();

      await user.press(screen.getByRole("button", { name: "Delete account" }));

      expect(dialog()).toBeOnTheScreen();
      expect(mockDeleteAccount).not.toHaveBeenCalled();
    });
  });

  describe("delete-account · explain-offline", () => {
    beforeEach(() => {
      onlineManager.setOnline(false);
    });

    it("should say it is offline in a status above the card, and not raise an alert", async () => {
      await renderScreen();

      expect(screen.getByRole("status")).toHaveTextContent(
        `${WORDS.offlineTitle}${WORDS.offlineBody}`,
      );
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });

    it("should disable Delete account, and say so to a screen reader, so a press opens nothing", async () => {
      const user = userEvent.setup();
      await renderScreen();

      const button = screen.getByRole("button", { name: "Delete account" });
      await user.press(button);

      expect(button).toBeDisabled();
      expect(screen.queryByLabelText(WORDS.dialogTitle)).not.toBeOnTheScreen();
    });

    it("should leave Back, Keep my account and Export my data as they are", async () => {
      await renderScreen();

      expect(screen.getByRole("button", { name: "Back to More" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Keep my account" })).toBeEnabled();
      expect(
        screen.getByRole("button", { name: "Export my data, Save a copy first" }),
      ).toBeEnabled();
    });

    it("should lose the banner and enable the button when the connection returns, with no reload", async () => {
      await renderScreen();

      await act(() => {
        onlineManager.setOnline(true);
      });

      expect(screen.queryByRole("status")).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Delete account" })).toBeEnabled();
    });
  });

  describe("delete-account · confirm", () => {
    it("should be an alert dialog named by its title, with the question as a heading", async () => {
      const user = userEvent.setup();
      await renderScreen();
      await user.press(screen.getByRole("button", { name: "Delete account" }));

      expect(dialog()).toHaveProp("role", "alertdialog");
      expect(dialog()).toHaveProp("aria-modal", true);
      expect(within(dialog()).getByRole("heading", { name: WORDS.dialogTitle })).toBeOnTheScreen();
      expect(within(dialog()).getByText(WORDS.dialogBody)).toBeOnTheScreen();
    });

    it("should close and delete nothing on Keep my account", async () => {
      const user = userEvent.setup();
      await renderScreen();
      await user.press(screen.getByRole("button", { name: "Delete account" }));

      await user.press(within(dialog()).getByRole("button", { name: "Keep my account" }));

      expect(screen.queryByLabelText(WORDS.dialogTitle)).not.toBeOnTheScreen();
      expect(mockDeleteAccount).not.toHaveBeenCalled();
    });

    it("should close and delete nothing on a press on the dim", async () => {
      const user = userEvent.setup();
      await renderScreen();
      await user.press(screen.getByRole("button", { name: "Delete account" }));

      await user.press(dim());

      expect(screen.queryByLabelText(WORDS.dialogTitle)).not.toBeOnTheScreen();
      expect(mockDeleteAccount).not.toHaveBeenCalled();
    });

    it("should close and delete nothing on the screen reader's escape gesture", async () => {
      const user = userEvent.setup();
      await renderScreen();
      await user.press(screen.getByRole("button", { name: "Delete account" }));

      await fireEvent(dialog(), "accessibilityEscape");

      expect(screen.queryByLabelText(WORDS.dialogTitle)).not.toBeOnTheScreen();
      expect(mockDeleteAccount).not.toHaveBeenCalled();
    });

    it("should close and delete nothing on the Android back button", async () => {
      const user = userEvent.setup();
      await renderScreen();
      await user.press(screen.getByRole("button", { name: "Delete account" }));

      await fireEvent(dialog(), "requestClose");

      expect(screen.queryByLabelText(WORDS.dialogTitle)).not.toBeOnTheScreen();
      expect(mockDeleteAccount).not.toHaveBeenCalled();
    });

    it("should delete the account, once, when Delete account is pressed in it", async () => {
      const user = userEvent.setup();
      const answer = holdTheDeletion();
      await renderScreen();
      await user.press(screen.getByRole("button", { name: "Delete account" }));

      await user.press(within(dialog()).getByRole("button", { name: "Delete account" }));
      await answer({ kind: "deleted" });

      expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
    });
  });

  describe("delete-account · deleting", () => {
    async function startDeleting() {
      const user = userEvent.setup();
      const answer = holdTheDeletion();
      await renderScreen();
      await user.press(screen.getByRole("button", { name: "Delete account" }));
      await user.press(within(dialog()).getByRole("button", { name: "Delete account" }));
      return { user, answer };
    }

    it("should change the title and the body, and name the busy button by what it is doing", async () => {
      await startDeleting();

      expect(
        within(deletingDialog()).getByRole("heading", { name: WORDS.deletingTitle }),
      ).toBeOnTheScreen();
      expect(within(deletingDialog()).getByText(WORDS.deletingBody)).toBeOnTheScreen();
      expect(
        within(deletingDialog()).getByRole("button", { name: WORDS.deletingTitle, busy: true }),
      ).toBeOnTheScreen();
      expect(screen.queryByLabelText(WORDS.dialogTitle)).not.toBeOnTheScreen();
    });

    it("should disable Keep my account, and say so to a screen reader", async () => {
      const { user } = await startDeleting();

      const keep = within(deletingDialog()).getByRole("button", { name: "Keep my account" });
      await user.press(keep);

      expect(keep).toBeDisabled();
    });

    it("should not be dismissed by the dim, the escape gesture or the Android back button", async () => {
      const { user } = await startDeleting();

      await user.press(dim());
      await fireEvent(deletingDialog(), "accessibilityEscape");
      await fireEvent(deletingDialog(), "requestClose");

      expect(deletingDialog()).toBeOnTheScreen();
      expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
    });

    it("should send one deletion however often the busy button is pressed", async () => {
      const { user } = await startDeleting();

      await user.press(within(deletingDialog()).getByRole("button", { name: WORDS.deletingTitle }));
      await user.press(within(deletingDialog()).getByRole("button", { name: WORDS.deletingTitle }));

      expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
    });
  });

  describe("when the deletion is confirmed", () => {
    it("should leave the navigation to AuthGate and not move the screen itself", async () => {
      await renderScreen();

      await deleteAndAnswer({ kind: "deleted" });

      expect(routerMock.replace).not.toHaveBeenCalled();
      expect(routerMock.push).not.toHaveBeenCalled();
      expect(routerMock.navigate).not.toHaveBeenCalled();
      expect(routerMock.back).not.toHaveBeenCalled();
      expect(routerMock.dismissTo).not.toHaveBeenCalled();
    });

    it("should not offer another deletion in the moment before Sign in opens", async () => {
      await renderScreen();

      await deleteAndAnswer({ kind: "deleted" });

      expect(
        within(deletingDialog()).getByRole("button", { name: WORDS.deletingTitle, busy: true }),
      ).toBeOnTheScreen();
    });
  });

  describe("delete-account · failed", () => {
    it("should close the dialog and show the error as an alert, with both sentences", async () => {
      await renderScreen();

      await deleteAndAnswer({ kind: "notDeleted", code: "internal_error" });

      expect(screen.queryByLabelText(WORDS.dialogTitle)).not.toBeOnTheScreen();
      expect(() => deletingDialog()).toThrow();
      expect(screen.getByRole("alert")).toHaveTextContent(
        `${WORDS.failedTitle}${WORDS.failedBody}`,
      );
    });

    it("should keep the card, the warning and Export my data, and swap the buttons for Try again and Keep my account", async () => {
      await renderScreen();

      await deleteAndAnswer({ kind: "notDeleted", code: "internal_error" });

      expect(screen.getByRole("heading", { name: WORDS.cardTitle })).toBeOnTheScreen();
      expect(screen.getByRole("note")).toHaveTextContent(WORDS.permanence);
      expect(
        screen.getByRole("button", { name: "Export my data, Save a copy first" }),
      ).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Keep my account" })).toBeEnabled();
      expect(screen.queryByRole("button", { name: "Delete account" })).not.toBeOnTheScreen();
    });

    it("should open the mail app with the address the Terms give, and cope with there being none", async () => {
      const user = userEvent.setup();
      const openURL = jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no mail app"));
      await renderScreen();
      await deleteAndAnswer({ kind: "notDeleted", code: "internal_error" });

      await user.press(screen.getByRole("button", { name: "Email hello@sojisoft.com" }));

      expect(openURL).toHaveBeenCalledWith("mailto:hello@sojisoft.com");
    });

    it("should reopen the confirm on Try again, and delete nothing until Delete account is pressed in it", async () => {
      const user = userEvent.setup();
      await renderScreen();
      await deleteAndAnswer({ kind: "notDeleted", code: "internal_error" });
      mockDeleteAccount.mockClear();

      await user.press(screen.getByRole("button", { name: "Try again" }));

      expect(dialog()).toBeOnTheScreen();
      expect(mockDeleteAccount).not.toHaveBeenCalled();
    });

    it("should keep the error behind the reopened confirm, and drop it when the next attempt starts", async () => {
      const user = userEvent.setup();
      await renderScreen();
      await deleteAndAnswer({ kind: "notDeleted", code: "internal_error" });
      await user.press(screen.getByRole("button", { name: "Try again" }));
      expect(screen.getByRole("alert")).toHaveTextContent(WORDS.failedTitle, { exact: false });
      holdTheDeletion();

      await user.press(within(dialog()).getByRole("button", { name: "Delete account" }));

      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });

    it("should go back to More from Keep my account and send nothing", async () => {
      const user = userEvent.setup();
      await renderScreen();
      await deleteAndAnswer({ kind: "notDeleted", code: "internal_error" });
      mockDeleteAccount.mockClear();

      await user.press(screen.getByRole("button", { name: "Keep my account" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
      expect(mockDeleteAccount).not.toHaveBeenCalled();
    });

    it("should show the offline banner under the error banner, and disable Try again until the connection returns", async () => {
      await renderScreen();
      await deleteAndAnswer({ kind: "notDeleted", code: "internal_error" });

      await act(() => {
        onlineManager.setOnline(false);
      });

      expect(screen.getByRole("status")).toHaveTextContent(
        `${WORDS.offlineTitle}${WORDS.offlineBody}`,
      );
      expect(screen.getByRole("alert")).toHaveTextContent(WORDS.failedTitle, { exact: false });
      expect(screen.getByRole("button", { name: "Try again" })).toBeDisabled();

      await act(() => {
        onlineManager.setOnline(true);
      });

      expect(screen.queryByRole("status")).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    });
  });

  describe("delete-account · unconfirmed", () => {
    const unconfirmed = { kind: "unconfirmed" } as const;

    it("should close the dialog and raise the warning as an alert, with both sentences", async () => {
      await renderScreen();

      await deleteAndAnswer(unconfirmed);

      expect(screen.queryByLabelText(WORDS.dialogTitle)).not.toBeOnTheScreen();
      expect(screen.getByRole("alert")).toHaveTextContent(
        `${WORDS.unconfirmedTitle}${WORDS.unconfirmedBody}`,
      );
    });

    it("should end in Try again and Back to More, with no email action", async () => {
      await renderScreen();

      await deleteAndAnswer(unconfirmed);

      expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
      expect(backButtons().footer).toBeEnabled();
      expect(screen.queryByRole("button", { name: /^Email/ })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Keep my account" })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Delete account" })).not.toBeOnTheScreen();
    });

    it("should keep the card, the warning and Export my data", async () => {
      await renderScreen();

      await deleteAndAnswer(unconfirmed);

      expect(screen.getByRole("heading", { name: WORDS.cardTitle })).toBeOnTheScreen();
      expect(screen.getByRole("note")).toHaveTextContent(WORDS.permanence);
      expect(
        screen.getByRole("button", { name: "Export my data, Save a copy first" }),
      ).toBeOnTheScreen();
    });

    it("should send the deletion again at once on Try again, with no second confirm", async () => {
      const user = userEvent.setup();
      await renderScreen();
      await deleteAndAnswer(unconfirmed);
      holdTheDeletion();

      await user.press(screen.getByRole("button", { name: "Try again" }));

      expect(mockDeleteAccount).toHaveBeenCalledTimes(2);
      expect(screen.queryByLabelText(WORDS.dialogTitle)).not.toBeOnTheScreen();
      expect(() => deletingDialog()).toThrow();
    });

    describe("while Try again runs", () => {
      async function startRetrying() {
        const user = userEvent.setup();
        await renderScreen();
        await deleteAndAnswer(unconfirmed);
        const answer = holdTheDeletion();
        await user.press(screen.getByRole("button", { name: "Try again" }));
        return { user, answer };
      }

      it("should show the spinner named Deleting your account and keep the warning", async () => {
        await startRetrying();

        expect(
          screen.getByRole("button", { name: WORDS.deletingTitle, busy: true }),
        ).toBeOnTheScreen();
        expect(screen.getByRole("alert")).toHaveTextContent(WORDS.unconfirmedTitle, {
          exact: false,
        });
      });

      it("should disable Back to More and the header Back", async () => {
        const { user } = await startRetrying();

        await user.press(backButtons().header);
        await user.press(backButtons().footer);

        expect(backButtons().footer).toBeDisabled();
        expect(backButtons().header).toBeDisabled();
        expect(routerMock.back).not.toHaveBeenCalled();
      });

      it("should take the Android back button and do nothing, and turn the swipe back off", async () => {
        await startRetrying();

        expect(await pressAndroidBackButton()).toBe(true);
        expect(routerMock.back).not.toHaveBeenCalled();
        expect(routerMock.screenOptions.at(-1)).toEqual({ gestureEnabled: false });
      });

      it("should send one deletion however often it is pressed", async () => {
        const { user } = await startRetrying();

        await user.press(screen.getByRole("button", { name: WORDS.deletingTitle }));
        await user.press(screen.getByRole("button", { name: WORDS.deletingTitle }));

        expect(mockDeleteAccount).toHaveBeenCalledTimes(2);
      });

      it("should let go of Back and the Android back button when no answer comes again, and keep the board", async () => {
        const { answer } = await startRetrying();

        await answer(unconfirmed);

        expect(screen.getByRole("alert")).toHaveTextContent(WORDS.unconfirmedTitle, {
          exact: false,
        });
        expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
        expect(backButtons().footer).toBeEnabled();
        expect(await pressAndroidBackButton()).toBe(false);
        expect(routerMock.screenOptions.at(-1)).toEqual({ gestureEnabled: true });
      });

      it("should show the failed board when the answer is that nothing was deleted", async () => {
        const { answer } = await startRetrying();

        await answer({ kind: "notDeleted", code: "internal_error" });

        expect(screen.getByRole("alert")).toHaveTextContent(WORDS.failedTitle, { exact: false });
      });

      it("should leave the navigation to AuthGate when the account turns out to be gone", async () => {
        const { answer } = await startRetrying();

        await answer({ kind: "deleted" });

        expect(routerMock.replace).not.toHaveBeenCalled();
        expect(routerMock.back).not.toHaveBeenCalled();
        expect(screen.getByRole("alert")).toHaveTextContent(WORDS.unconfirmedTitle, {
          exact: false,
        });
        expect(
          screen.getByRole("button", { name: WORDS.deletingTitle, busy: true }),
        ).toBeOnTheScreen();
      });
    });

    it("should return to More from Back to More and from the header Back, and send nothing", async () => {
      const user = userEvent.setup();
      await renderScreen();
      await deleteAndAnswer(unconfirmed);
      mockDeleteAccount.mockClear();

      await user.press(backButtons().footer);
      await user.press(backButtons().header);

      expect(routerMock.back).toHaveBeenCalledTimes(2);
      expect(mockDeleteAccount).not.toHaveBeenCalled();
    });

    it("should leave the Android back button to the stack once it is not retrying", async () => {
      await renderScreen();
      await deleteAndAnswer(unconfirmed);

      expect(await pressAndroidBackButton()).toBe(false);
    });

    it("should disable Try again while offline, and add no offline banner", async () => {
      await renderScreen();
      await deleteAndAnswer(unconfirmed);

      await act(() => {
        onlineManager.setOnline(false);
      });

      expect(screen.getByRole("button", { name: "Try again" })).toBeDisabled();
      expect(screen.queryByRole("status")).not.toBeOnTheScreen();

      await act(() => {
        onlineManager.setOnline(true);
      });

      expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    });
  });

  describe("when the deletion cannot even start", () => {
    it("should show the unconfirmed board, because nothing is known about the account", async () => {
      const user = userEvent.setup();
      mockDeleteAccount.mockRejectedValueOnce(new Error("storage unreadable"));
      await renderScreen();
      await user.press(screen.getByRole("button", { name: "Delete account" }));

      await user.press(within(dialog()).getByRole("button", { name: "Delete account" }));

      expect(screen.queryByLabelText(WORDS.dialogTitle)).not.toBeOnTheScreen();
      expect(screen.getByRole("alert")).toHaveTextContent(WORDS.unconfirmedTitle, { exact: false });
    });
  });
});
