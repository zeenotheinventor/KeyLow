import { KeyLowProvider, keys } from "@keylow/api-client";
import { ACCEPT_TERMS_SCREEN, GENERIC_ERROR, TERMS_VERSION } from "@keylow/core/copy";
import { focusManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { AuthGate } from "../components/AuthGate";
import { TERMS_GATE_HOLD_LIMIT_MS, holdTermsGate } from "../lib/termsGateHold";
import { ThemeProvider } from "../lib/theme";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { fakeSession, mockSupabaseClient, resetSupabaseMock } from "./support/supabaseMock";
import {
  createTestQueryClient,
  resetTermsBackend,
  termsBackend,
  termsClient,
} from "./support/termsBackend";

import type { TermsAcceptance } from "@keylow/core/terms";
import type { QueryClient } from "@tanstack/react-query";

jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock("../lib/supabase", () => ({
  supabase: jest.requireActual<{ mockSupabaseClient: unknown }>("./support/supabaseMock")
    .mockSupabaseClient,
}));

const acceptanceSentence =
  "I accept the Terms and the Privacy Policy, including storing my weight, food diary, body stats and workouts to run the app.";

const currentAcceptance: TermsAcceptance = {
  terms_accepted_at: "2026-10-15T09:30:00+00:00",
  terms_version: TERMS_VERSION,
};

let queryClient: QueryClient;

async function renderSignedInGate(segments: string[] = ["(tabs)", "diary"]) {
  mockSupabaseClient.auth.getSession.mockResolvedValue({
    data: { session: fakeSession },
    error: null,
  });
  routerMock.segments = segments;
  queryClient = createTestQueryClient();

  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={termsClient} queryClient={queryClient}>
        <AuthGate>
          <Text>Protected content</Text>
        </AuthGate>
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

const acceptHeading = () => screen.queryByRole("heading", { name: ACCEPT_TERMS_SCREEN.heading });

describe("the accept-to-continue gate", () => {
  beforeEach(() => {
    resetRouterMock();
    resetSupabaseMock();
    resetTermsBackend();
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
  });

  describe("while the acceptance is loading", () => {
    it("should show neither the app nor the accept form", async () => {
      termsBackend.readGate = new Promise(() => undefined);

      await renderSignedInGate();

      await waitFor(() => {
        expect(termsBackend.readCount).toBe(1);
      });
      expect(screen.queryByText("Protected content")).not.toBeOnTheScreen();
      expect(acceptHeading()).not.toBeOnTheScreen();
      expect(screen.queryByRole("checkbox")).not.toBeOnTheScreen();
      expect(screen.getByRole("img", { name: "Ki-Lo" })).toBeOnTheScreen();
    });
  });

  describe("when the acceptance cannot be read", () => {
    beforeEach(() => {
      termsBackend.readFails = true;
    });

    it("should fail closed with the fixed sentence, a retry and Sign out", async () => {
      await renderSignedInGate();

      expect(await screen.findByRole("alert", { name: GENERIC_ERROR })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Try again" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Sign out" })).toBeOnTheScreen();
      expect(screen.queryByText("Protected content")).not.toBeOnTheScreen();
      expect(acceptHeading()).not.toBeOnTheScreen();
      expect(screen.queryByRole("checkbox")).not.toBeOnTheScreen();
    });

    it("should never show the raw error text", async () => {
      await renderSignedInGate();

      await screen.findByRole("alert", { name: GENERIC_ERROR });
      expect(screen.queryByText(/raw database text/)).not.toBeOnTheScreen();
      expect(screen.queryByText(/connection lost/)).not.toBeOnTheScreen();
    });

    it("should let the app in when the retry reads a current acceptance", async () => {
      await renderSignedInGate();
      await screen.findByRole("alert", { name: GENERIC_ERROR });
      termsBackend.readFails = false;
      termsBackend.row = currentAcceptance;

      await userEvent.setup().press(screen.getByRole("button", { name: "Try again" }));

      expect(await screen.findByText("Protected content")).toBeOnTheScreen();
    });

    it("should sign out from the error state", async () => {
      await renderSignedInGate();
      await screen.findByRole("alert", { name: GENERIC_ERROR });

      await userEvent.setup().press(screen.getByRole("button", { name: "Sign out" }));

      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalledTimes(1);
    });
  });

  describe("when the account has no current acceptance", () => {
    const withoutCurrentAcceptance: [string, TermsAcceptance | null][] = [
      ["has no profile row", null],
      ["has never accepted", { terms_accepted_at: null, terms_version: null }],
      [
        "accepted an older version",
        { terms_accepted_at: "2026-01-01T00:00:00+00:00", terms_version: "2025-01-01" },
      ],
    ];

    it.each(withoutCurrentAcceptance)(
      "should show the accept screen and not the app for an account that %s",
      async (_description, row) => {
        termsBackend.row = row;

        await renderSignedInGate();

        expect(
          await screen.findByRole("heading", { name: ACCEPT_TERMS_SCREEN.heading }),
        ).toBeOnTheScreen();
        expect(screen.getByText(ACCEPT_TERMS_SCREEN.caption)).toBeOnTheScreen();
        expect(screen.queryByText("Protected content")).not.toBeOnTheScreen();
      },
    );

    it("should keep Continue disabled until the box is ticked", async () => {
      await renderSignedInGate();
      const continueButton = await screen.findByRole("button", {
        name: ACCEPT_TERMS_SCREEN.continueLabel,
      });
      expect(continueButton).toBeDisabled();

      const user = userEvent.setup();
      await user.press(screen.getByRole("checkbox", { name: acceptanceSentence }));
      expect(continueButton).toBeEnabled();

      await user.press(screen.getByRole("checkbox", { name: acceptanceSentence }));
      expect(continueButton).toBeDisabled();
    });

    it("should not record anything when Continue is pressed with the box unticked", async () => {
      await renderSignedInGate();
      const continueButton = await screen.findByRole("button", {
        name: ACCEPT_TERMS_SCREEN.continueLabel,
      });

      await userEvent.setup().press(continueButton);

      expect(termsBackend.acceptedVersions).toEqual([]);
    });

    it("should record the current version and let the app in once it is accepted", async () => {
      await renderSignedInGate();
      const user = userEvent.setup();
      await user.press(await screen.findByRole("checkbox", { name: acceptanceSentence }));

      await user.press(screen.getByRole("button", { name: ACCEPT_TERMS_SCREEN.continueLabel }));

      expect(await screen.findByText("Protected content")).toBeOnTheScreen();
      expect(termsBackend.acceptedVersions).toEqual([TERMS_VERSION]);
      expect(acceptHeading()).not.toBeOnTheScreen();
    });

    it("should stay on the screen with the fixed sentence when recording fails", async () => {
      termsBackend.acceptFails = true;
      await renderSignedInGate();
      const user = userEvent.setup();
      await user.press(await screen.findByRole("checkbox", { name: acceptanceSentence }));

      await user.press(screen.getByRole("button", { name: ACCEPT_TERMS_SCREEN.continueLabel }));

      expect(await screen.findByText(GENERIC_ERROR)).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: ACCEPT_TERMS_SCREEN.heading })).toBeOnTheScreen();
      expect(screen.queryByText("Protected content")).not.toBeOnTheScreen();
      expect(screen.queryByText(/raw database text/)).not.toBeOnTheScreen();
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: ACCEPT_TERMS_SCREEN.continueLabel }),
        ).toBeEnabled();
      });
    });

    it("should sign out from the accept screen", async () => {
      await renderSignedInGate();
      await screen.findByRole("heading", { name: ACCEPT_TERMS_SCREEN.heading });

      await userEvent
        .setup()
        .press(screen.getByRole("button", { name: ACCEPT_TERMS_SCREEN.signOutLabel }));

      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalledTimes(1);
    });
  });

  it("should let an account with a current acceptance straight into the app", async () => {
    termsBackend.row = currentAcceptance;

    await renderSignedInGate();

    expect(await screen.findByText("Protected content")).toBeOnTheScreen();
    expect(acceptHeading()).not.toBeOnTheScreen();
  });

  it("should not read the acceptance for a signed-out user", async () => {
    routerMock.segments = ["(auth)", "sign-in"];
    queryClient = createTestQueryClient();

    await render(
      <ThemeProvider fixedPreference="dark">
        <KeyLowProvider client={termsClient} queryClient={queryClient}>
          <AuthGate>
            <Text>Protected content</Text>
          </AuthGate>
        </KeyLowProvider>
      </ThemeProvider>,
    );

    expect(termsBackend.readCount).toBe(0);
    expect(screen.getByText("Protected content")).toBeOnTheScreen();
  });

  describe("a native modal route outside the tabs", () => {
    it("should send an account with no current acceptance to the dashboard", async () => {
      termsBackend.row = null;

      await renderSignedInGate(["foods", "new"]);

      await screen.findByRole("heading", { name: ACCEPT_TERMS_SCREEN.heading });
      await waitFor(() => {
        expect(routerMock.replace).toHaveBeenCalledWith("/(tabs)/dashboard");
      });
      expect(screen.queryByText("Protected content")).not.toBeOnTheScreen();
    });

    it("should send an account whose acceptance could not be read to the dashboard", async () => {
      termsBackend.readFails = true;

      await renderSignedInGate(["foods", "new"]);

      await screen.findByRole("alert", { name: GENERIC_ERROR });
      await waitFor(() => {
        expect(routerMock.replace).toHaveBeenCalledWith("/(tabs)/dashboard");
      });
      expect(screen.queryByText("Protected content")).not.toBeOnTheScreen();
    });

    it("should leave an account with a current acceptance on it", async () => {
      termsBackend.row = currentAcceptance;

      await renderSignedInGate(["foods", "new"]);

      expect(await screen.findByText("Protected content")).toBeOnTheScreen();
      expect(routerMock.replace).not.toHaveBeenCalled();
    });

    it("should not send an account with no current acceptance away from the tabs", async () => {
      await renderSignedInGate();

      await screen.findByRole("heading", { name: ACCEPT_TERMS_SCREEN.heading });
      expect(routerMock.replace).not.toHaveBeenCalled();
    });
  });

  describe("when the acceptance cannot be read and the gate is loading", () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it("should call the read failed after one short retry", async () => {
      jest.useFakeTimers();
      termsBackend.readFails = true;
      await renderSignedInGate();
      await waitFor(() => {
        expect(termsBackend.readCount).toBe(1);
      });
      expect(screen.queryByRole("alert", { name: GENERIC_ERROR })).not.toBeOnTheScreen();

      await act(() => {
        jest.advanceTimersByTime(499);
      });
      expect(termsBackend.readCount).toBe(1);

      await act(() => {
        jest.advanceTimersByTime(1);
      });
      await waitFor(() => {
        expect(termsBackend.readCount).toBe(2);
      });
      expect(await screen.findByRole("alert", { name: GENERIC_ERROR })).toBeOnTheScreen();

      await act(() => {
        jest.advanceTimersByTime(60_000);
      });
      expect(termsBackend.readCount).toBe(2);
    });
  });

  describe("when an acceptance that is already known cannot be read again", () => {
    afterEach(() => {
      focusManager.setFocused(undefined);
    });

    it("should keep the app open when a refetch on return to the foreground fails", async () => {
      termsBackend.row = currentAcceptance;
      await renderSignedInGate();
      expect(await screen.findByText("Protected content")).toBeOnTheScreen();
      const readsBefore = termsBackend.readCount;
      termsBackend.readFails = true;

      await act(() => {
        focusManager.setFocused(false);
        focusManager.setFocused(true);
      });

      await waitFor(() => {
        expect(queryClient.getQueryState(keys.profiles.termsAcceptance)?.status).toBe("error");
      });
      // Lets the screen draw what the failed read left behind.
      await act(async () => {
        await Promise.resolve();
      });
      expect(termsBackend.readCount).toBeGreaterThan(readsBefore);
      expect(screen.getByText("Protected content")).toBeOnTheScreen();
      expect(screen.queryByRole("alert", { name: GENERIC_ERROR })).not.toBeOnTheScreen();
    });

    it("should still fail closed when the acceptance was never read", async () => {
      termsBackend.readFails = true;

      await renderSignedInGate();

      expect(await screen.findByRole("alert", { name: GENERIC_ERROR })).toBeOnTheScreen();
      expect(screen.queryByText("Protected content")).not.toBeOnTheScreen();
    });
  });

  describe("when the wait is long", () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it("should show Sign out under the mark only after a few seconds of loading", async () => {
      jest.useFakeTimers();
      termsBackend.readGate = new Promise(() => undefined);
      await renderSignedInGate();
      expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeOnTheScreen();

      await act(() => {
        jest.advanceTimersByTime(2999);
      });
      expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeOnTheScreen();

      await act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(screen.getByRole("button", { name: "Sign out" })).toBeOnTheScreen();
      expect(screen.queryByText("Protected content")).not.toBeOnTheScreen();
    });

    it("should show the accept screen when a hold on the gate runs out", async () => {
      jest.useFakeTimers();
      await act(() => {
        holdTermsGate();
      });
      await renderSignedInGate();
      await waitFor(() => {
        expect(termsBackend.readCount).toBe(1);
      });
      expect(acceptHeading()).not.toBeOnTheScreen();

      await act(() => {
        jest.advanceTimersByTime(TERMS_GATE_HOLD_LIMIT_MS);
      });

      expect(
        await screen.findByRole("heading", { name: ACCEPT_TERMS_SCREEN.heading }),
      ).toBeOnTheScreen();
    });
  });
});
