import { KeyLowProvider } from "@keylow/api-client";
import { ACCEPT_TERMS_SCREEN, TERMS_VERSION } from "@keylow/core/copy";
import { cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";

import SignUpRoute from "../app/(auth)/sign-up";
import { AuthGate } from "../components/AuthGate";
import { ThemeProvider } from "../lib/theme";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { resetGoogleSignInMock } from "./support/googleSignInMock";
import {
  emitAuthStateChange,
  fakeSession,
  mockSupabaseClient,
  resetSupabaseMock,
} from "./support/supabaseMock";
import {
  createTestQueryClient,
  resetTermsBackend,
  termsBackend,
  termsClient,
} from "./support/termsBackend";

import type { QueryClient } from "@tanstack/react-query";

jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: jest.requireActual<{ mockGoogleSignin: unknown }>("./support/googleSignInMock")
    .mockGoogleSignin,
}));
jest.mock("../lib/supabase", () => ({
  supabase: jest.requireActual<{ mockSupabaseClient: unknown }>("./support/supabaseMock")
    .mockSupabaseClient,
}));

const acceptanceSentence =
  "I accept the Terms and the Privacy Policy, including storing my weight, food diary and body stats to run the app.";

let queryClient: QueryClient;
let finishAcceptCall: () => void;

// The first screen of the real flow: sign up with Google, which signs in (and so starts the session the
// gate reacts to) before it records the acceptance through the repo function.
async function pressGoogleOnTheSignUpScreen() {
  routerMock.segments = ["(auth)", "sign-up"];
  queryClient = createTestQueryClient();
  mockSupabaseClient.auth.signInWithIdToken.mockImplementation(() => {
    emitAuthStateChange("SIGNED_IN", fakeSession);
    return Promise.resolve({ data: {}, error: null });
  });
  // googleSignIn records the acceptance through the repo function on the app's own client.
  mockSupabaseClient.rpc.mockImplementation((_name: string, args: { p_version: string }) =>
    termsClient.rpc("accept_terms", args),
  );
  termsBackend.acceptGate = new Promise((resolve) => {
    finishAcceptCall = () => {
      resolve();
    };
  });

  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={termsClient} queryClient={queryClient}>
        <AuthGate>
          <SignUpRoute />
        </AuthGate>
      </KeyLowProvider>
    </ThemeProvider>,
  );

  const user = userEvent.setup();
  await user.press(await screen.findByRole("checkbox", { name: acceptanceSentence }));
  await user.press(screen.getByRole("button", { name: "Continue with Google" }));
}

describe("the accept-to-continue gate after a Google sign-up", () => {
  beforeEach(() => {
    resetRouterMock();
    resetSupabaseMock();
    resetGoogleSignInMock();
    resetTermsBackend();
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
  });

  it("should never ask the person who just ticked the box to accept again", async () => {
    await pressGoogleOnTheSignUpScreen();

    // The session exists and the gate has read the acceptance, which is still empty because the
    // acceptance is only being recorded.
    await waitFor(() => {
      expect(termsBackend.readCount).toBeGreaterThan(0);
    });
    expect(
      screen.queryByRole("heading", { name: ACCEPT_TERMS_SCREEN.heading }),
    ).not.toBeOnTheScreen();
    expect(screen.queryByRole("checkbox")).not.toBeOnTheScreen();

    finishAcceptCall();

    await waitFor(() => {
      expect(termsBackend.acceptedVersions).toEqual([TERMS_VERSION]);
    });
    expect(await screen.findByRole("button", { name: "Create account" })).toBeOnTheScreen();
    expect(
      screen.queryByRole("heading", { name: ACCEPT_TERMS_SCREEN.heading }),
    ).not.toBeOnTheScreen();
  });

  it("should ask the person to accept when recording the acceptance failed", async () => {
    termsBackend.acceptFails = true;
    jest.spyOn(console, "warn").mockImplementation(() => undefined);

    await pressGoogleOnTheSignUpScreen();
    await waitFor(() => {
      expect(termsBackend.readCount).toBeGreaterThan(0);
    });
    finishAcceptCall();

    expect(
      await screen.findByRole("heading", { name: ACCEPT_TERMS_SCREEN.heading }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Create account" })).not.toBeOnTheScreen();
  });
});
