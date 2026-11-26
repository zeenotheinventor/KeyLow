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
import { takeForgotPasswordEmail } from "../lib/forgotPasswordEmail";
import { ThemeProvider } from "../lib/theme";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { installVirtualClock } from "./support/virtualClock";

import type { DeleteAccountOnDeviceResult } from "../lib/accountDeletion/types";
import type { ReauthenticationOutcome } from "@keylow/core/accounts";
import type { User } from "@supabase/supabase-js";

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
// Who is signed in. The api-client hook is KEY-1124's and is tested where it lives, so it is mocked at its module
// boundary with the same mutation settings, and answers an empty password as the real call does, without a request.
const mockSessionUser = jest.fn<User | null, []>();
const mockReauthenticate = jest.fn<Promise<ReauthenticationOutcome>, [{ password: string }]>();

// The last mutation the screen holds for the password check, so a test can see what it still keeps.
const mockReauthenticationMutation: { current: { variables: unknown } | undefined } = {
  current: undefined,
};

jest.mock("../lib/useSessionUser", () => ({ useSessionUser: () => mockSessionUser() }));
jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useReauthenticateWithPassword: () => {
    const mutation = jest
      .requireActual<typeof import("@tanstack/react-query")>("@tanstack/react-query")
      .useMutation({
        mutationFn: (input: { password: string }) =>
          input.password === ""
            ? Promise.resolve<ReauthenticationOutcome>({ kind: "emptyPassword" })
            : mockReauthenticate(input),
        retry: false,
        networkMode: "always",
        gcTime: 0,
      });
    mockReauthenticationMutation.current = mutation;
    return mutation;
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
  passwordBody:
    "Everything in your account is deleted now. This cannot be undone. Enter your password to confirm.",
  wrongPassword: "That password is not right. Nothing was deleted.",
  generic: "Something went wrong. Try again.",
  tooManyAttempts: "Too many attempts. Wait a few minutes, then try again.",
  network: "Ki-Lo could not reach the server. Check your connection and try again.",
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

// A signed in account built at run time, so no address or password is written into the repository.
function accountWith(appMetadata: User["app_metadata"], email?: string): User {
  return {
    id: globalThis.crypto.randomUUID(),
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00Z",
    app_metadata: appMetadata,
    user_metadata: {},
    ...(email === undefined ? {} : { email }),
  };
}

const emailAddress = `${globalThis.crypto.randomUUID()}@keylow.test`;
const emailAccount = () => accountWith({ provider: "email", providers: ["email"] }, emailAddress);
const googleOnlyAccount = () => accountWith({ provider: "google", providers: ["google"] });

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
    mockReauthenticate.mockReset();
    mockSessionUser.mockReset();
    // A Google only account keeps the plain confirm, which every board before confirm-password draws.
    mockSessionUser.mockReturnValue(googleOnlyAccount());
    takeForgotPasswordEmail();
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
  describe("delete-account · confirm-password", () => {
    const strongPassword = globalThis.crypto.randomUUID();

    beforeEach(() => {
      mockSessionUser.mockReturnValue(emailAccount());
    });

    const field = () => within(dialog()).getByLabelText("Password");

    async function openConfirm() {
      const user = userEvent.setup();
      await renderScreen();
      await user.press(screenDeleteButton());
      return user;
    }

    async function typeAndPressDelete(user: ReturnType<typeof userEvent.setup>, typed: string) {
      if (typed !== "") {
        await user.type(field(), typed);
      }
      await user.press(within(dialog()).getByRole("button", { name: "Delete account" }));
    }

    it("should ask the question, then to enter the password, with a Password field and a Forgot password? link", async () => {
      await openConfirm();

      expect(within(dialog()).getByRole("heading", { name: WORDS.dialogTitle })).toBeOnTheScreen();
      expect(within(dialog()).getByText(WORDS.passwordBody)).toBeOnTheScreen();
      expect(field()).toBeOnTheScreen();
      expect(within(dialog()).getByRole("link", { name: "Forgot password?" })).toBeOnTheScreen();
      expect(within(dialog()).getByRole("button", { name: "Delete account" })).toBeEnabled();
      expect(within(dialog()).getByRole("button", { name: "Keep my account" })).toBeEnabled();
    });

    it("should draw the field under the sentence, with the link under the field", async () => {
      await openConfirm();

      expectInOrder([WORDS.passwordBody, "Password", "Forgot password?"]);
    });

    it("should hide what is typed, and not focus the field when the dialog opens", async () => {
      await openConfirm();

      expect(field()).toHaveProp("secureTextEntry", true);
      expect(field()).not.toHaveProp("autoFocus", true);
      expect(field()).toHaveDisplayValue("");
    });

    it("should not hold Delete account disabled while the field is empty, and say Enter your password when it is pressed", async () => {
      const user = await openConfirm();

      await typeAndPressDelete(user, "");

      expect(within(dialog()).getByRole("alert")).toHaveTextContent("Enter your password");
      expect(mockDeleteAccount).not.toHaveBeenCalled();
    });

    it("should check the password on the press and delete only once it is confirmed", async () => {
      const user = await openConfirm();
      mockReauthenticate.mockResolvedValueOnce({ kind: "confirmed" });
      mockDeleteAccount.mockResolvedValueOnce({ kind: "deleted" });

      await typeAndPressDelete(user, strongPassword);

      expect(mockReauthenticate).toHaveBeenCalledWith({ password: strongPassword });
      expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
      expect(mockReauthenticate.mock.invocationCallOrder[0]).toBeLessThan(
        mockDeleteAccount.mock.invocationCallOrder[0] ?? 0,
      );
    });

    it("should send nothing to delete-account while the password is being checked", async () => {
      const user = await openConfirm();
      mockReauthenticate.mockImplementationOnce(() => new Promise(() => undefined));

      await typeAndPressDelete(user, strongPassword);

      expect(mockDeleteAccount).not.toHaveBeenCalled();
    });

    it("should lock the dialog while the password is checked: the field, the dim, the escape gesture and the back button", async () => {
      const user = await openConfirm();
      mockReauthenticate.mockImplementationOnce(() => new Promise(() => undefined));

      await typeAndPressDelete(user, strongPassword);
      await user.press(dim());
      await fireEvent(dialog(), "accessibilityEscape");
      await fireEvent(dialog(), "requestClose");

      expect(dialog()).toBeOnTheScreen();
      expect(field()).toBeDisabled();
      expect(within(dialog()).getByRole("button", { name: "Keep my account" })).toBeDisabled();
    });

    describe("delete-account · confirm-password-wrong", () => {
      async function submitWrongPassword() {
        const user = await openConfirm();
        mockReauthenticate.mockResolvedValueOnce({ kind: "wrongPassword" });
        await typeAndPressDelete(user, strongPassword);
        return user;
      }

      it("should stay open, say the password is not right as an alert, and delete nothing", async () => {
        await submitWrongPassword();

        expect(dialog()).toBeOnTheScreen();
        expect(within(dialog()).getByRole("alert")).toHaveTextContent(WORDS.wrongPassword);
        expect(mockDeleteAccount).not.toHaveBeenCalled();
      });

      it("should keep the typed password in the field", async () => {
        await submitWrongPassword();

        expect(field()).toHaveDisplayValue(strongPassword);
      });

      it("should take the error away when the field is edited", async () => {
        const user = await submitWrongPassword();

        await user.type(field(), "x");

        expect(within(dialog()).queryByRole("alert")).not.toBeOnTheScreen();
      });

      it("should let the person try a right password next, and delete then", async () => {
        const user = await submitWrongPassword();
        mockReauthenticate.mockResolvedValueOnce({ kind: "confirmed" });
        mockDeleteAccount.mockResolvedValueOnce({ kind: "deleted" });

        await user.press(within(dialog()).getByRole("button", { name: "Delete account" }));

        expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
      });
    });

    it("should say too many attempts with the sentence Sign in uses", async () => {
      const user = await openConfirm();
      mockReauthenticate.mockResolvedValueOnce({ kind: "tooManyAttempts" });

      await typeAndPressDelete(user, strongPassword);

      expect(within(dialog()).getByRole("alert")).toHaveTextContent(WORDS.tooManyAttempts);
      expect(mockDeleteAccount).not.toHaveBeenCalled();
    });

    it("should say Ki-Lo could not reach the server when the check had no connection", async () => {
      const user = await openConfirm();
      mockReauthenticate.mockResolvedValueOnce({ kind: "network" });

      await typeAndPressDelete(user, strongPassword);

      expect(within(dialog()).getByRole("alert")).toHaveTextContent(WORDS.network);
      expect(mockDeleteAccount).not.toHaveBeenCalled();
    });

    it("should lock the field while the deletion runs, with the deleting words and no link press", async () => {
      const user = await openConfirm();
      const answer = holdTheDeletion();
      mockReauthenticate.mockResolvedValueOnce({ kind: "confirmed" });

      await typeAndPressDelete(user, strongPassword);

      expect(
        within(deletingDialog()).getByRole("heading", { name: WORDS.deletingTitle }),
      ).toBeOnTheScreen();
      expect(within(deletingDialog()).getByText(WORDS.deletingBody)).toBeOnTheScreen();
      expect(within(deletingDialog()).getByLabelText("Password")).toBeDisabled();

      await user.press(within(deletingDialog()).getByRole("link", { name: "Forgot password?" }));

      expect(routerMock.push).not.toHaveBeenCalled();
      await answer({ kind: "deleted" });
    });

    it("should close on Forgot password?, open the Forgot password screen with the account's email, and delete nothing", async () => {
      const user = await openConfirm();

      await user.press(within(dialog()).getByRole("link", { name: "Forgot password?" }));

      expect(screen.queryByLabelText(WORDS.dialogTitle)).not.toBeOnTheScreen();
      expect(routerMock.push).toHaveBeenCalledWith("/more/forgot-password");
      expect(takeForgotPasswordEmail()).toBe(emailAddress);
      expect(mockReauthenticate).not.toHaveBeenCalled();
      expect(mockDeleteAccount).not.toHaveBeenCalled();
    });

    it("should reopen with an empty field after Keep my account", async () => {
      const user = await openConfirm();
      await user.type(field(), strongPassword);
      await user.press(within(dialog()).getByRole("button", { name: "Keep my account" }));

      await user.press(screenDeleteButton());

      expect(field()).toHaveDisplayValue("");
    });

    it("should reopen with an empty field on Try again after the server refused the deletion", async () => {
      const user = await openConfirm();
      mockReauthenticate.mockResolvedValueOnce({ kind: "confirmed" });
      mockDeleteAccount.mockResolvedValueOnce({ kind: "notDeleted", code: "internal_error" });
      await typeAndPressDelete(user, strongPassword);

      await user.press(screen.getByRole("button", { name: "Try again" }));

      expect(dialog()).toBeOnTheScreen();
      expect(field()).toHaveDisplayValue("");
      expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
    });

    it("should ask for the password again when Try again on the unconfirmed board is refused for want of a fresh sign-in", async () => {
      const user = await openConfirm();
      mockReauthenticate.mockResolvedValueOnce({ kind: "confirmed" });
      mockDeleteAccount.mockResolvedValueOnce({ kind: "unconfirmed" });
      await typeAndPressDelete(user, strongPassword);
      mockDeleteAccount.mockResolvedValueOnce({
        kind: "notDeleted",
        code: "reauthentication_required",
      });

      await user.press(screen.getByRole("button", { name: "Try again" }));

      expect(dialog()).toBeOnTheScreen();
      expect(within(dialog()).getByText(WORDS.passwordBody)).toBeOnTheScreen();
      expect(field()).toHaveDisplayValue("");
      expect(screen.queryByText(WORDS.unconfirmedTitle)).not.toBeOnTheScreen();
      expect(screen.queryByText(WORDS.failedTitle)).not.toBeOnTheScreen();
    });
  });

  describe("when the password step cannot be trusted or must not leak", () => {
    const typedPassword = globalThis.crypto.randomUUID();

    beforeEach(() => {
      mockSessionUser.mockReturnValue(emailAccount());
    });

    async function pressDeleteWithPassword() {
      const user = userEvent.setup();
      await renderScreen();
      await user.press(screenDeleteButton());
      await user.type(within(dialog()).getByLabelText("Password"), typedPassword);
      await user.press(within(dialog()).getByRole("button", { name: "Delete account" }));
      return user;
    }

    it("should keep no password in the check's mutation once Keep my account closes the dialog after a wrong one", async () => {
      mockReauthenticate.mockResolvedValueOnce({ kind: "wrongPassword" });
      const user = await pressDeleteWithPassword();

      await user.press(within(dialog()).getByRole("button", { name: "Keep my account" }));

      expect(mockReauthenticationMutation.current?.variables).toBeUndefined();
    });

    it("should keep no password in the check's mutation once the answer is mapped", async () => {
      mockReauthenticate.mockResolvedValueOnce({ kind: "wrongPassword" });

      await pressDeleteWithPassword();

      expect(mockReauthenticationMutation.current?.variables).toBeUndefined();
    });

    it("should reopen the password confirm when the first confirm is refused for want of a fresh sign-in", async () => {
      mockReauthenticate.mockResolvedValueOnce({ kind: "confirmed" });
      mockDeleteAccount.mockResolvedValueOnce({
        kind: "notDeleted",
        code: "reauthentication_required",
      });

      await pressDeleteWithPassword();

      expect(dialog()).toBeOnTheScreen();
      expect(within(dialog()).getByLabelText("Password")).toHaveDisplayValue("");
      expect(screen.queryByText(WORDS.failedTitle)).not.toBeOnTheScreen();
    });

    it.each([
      ["a session that has ended", { kind: "sessionEnded" }],
      ["an unexpected failure", { kind: "failed" }],
    ] as const)(
      "should say the generic sentence for %s, and delete nothing",
      async (_name, answer) => {
        mockReauthenticate.mockResolvedValueOnce(answer);

        await pressDeleteWithPassword();

        expect(within(dialog()).getByRole("alert")).toHaveTextContent(WORDS.generic);
        expect(mockDeleteAccount).not.toHaveBeenCalled();
      },
    );

    it("should say the generic sentence when the check throws, and delete nothing", async () => {
      mockReauthenticate.mockRejectedValueOnce(new Error("could not run"));

      await pressDeleteWithPassword();

      expect(within(dialog()).getByRole("alert")).toHaveTextContent(WORDS.generic);
      expect(mockDeleteAccount).not.toHaveBeenCalled();
    });

    it("should swallow the Android back button while the password is checked", async () => {
      mockReauthenticate.mockImplementationOnce(() => new Promise(() => undefined));
      await pressDeleteWithPassword();

      expect(await pressAndroidBackButton()).toBe(true);
    });
  });

  describe("before the signed in account is read", () => {
    it("should fail open: Delete account is enabled and the plain confirm shows, as the server enforces the password", async () => {
      mockSessionUser.mockReturnValue(null);
      const user = userEvent.setup();
      await renderScreen();

      const button = screenDeleteButton();
      await user.press(button);

      expect(button).toBeEnabled();
      expect(within(dialog()).getByText(WORDS.dialogBody)).toBeOnTheScreen();
      expect(within(dialog()).queryByLabelText("Password")).not.toBeOnTheScreen();
    });
  });

  describe("a Google only account", () => {
    it("should keep the plain confirm, with no field and no link, and delete with no password check", async () => {
      const user = userEvent.setup();
      mockDeleteAccount.mockResolvedValueOnce({ kind: "deleted" });
      await renderScreen();

      await user.press(screenDeleteButton());

      expect(within(dialog()).getByText(WORDS.dialogBody)).toBeOnTheScreen();
      expect(within(dialog()).queryByLabelText("Password")).not.toBeOnTheScreen();
      expect(within(dialog()).queryByRole("link")).not.toBeOnTheScreen();

      await user.press(within(dialog()).getByRole("button", { name: "Delete account" }));

      expect(mockReauthenticate).not.toHaveBeenCalled();
      expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
    });
  });
});
