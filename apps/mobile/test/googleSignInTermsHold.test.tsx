import { TERMS_VERSION } from "@keylow/core/copy";
import { AuthApiError } from "@supabase/supabase-js";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { signInWithGoogle } from "../lib/googleSignIn";
import { useIsTermsGateHeld } from "../lib/termsGateHold";
import { resetGoogleSignInMock } from "./support/googleSignInMock";
import { mockSupabaseClient, resetSupabaseMock } from "./support/supabaseMock";

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: jest.requireActual<{ mockGoogleSignin: unknown }>("./support/googleSignInMock")
    .mockGoogleSignin,
}));
jest.mock("../lib/supabase", () => ({
  supabase: jest.requireActual<{ mockSupabaseClient: unknown }>("./support/supabaseMock")
    .mockSupabaseClient,
}));

describe("signInWithGoogle and the terms gate hold", () => {
  beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    resetSupabaseMock();
    resetGoogleSignInMock();
    mockSupabaseClient.auth.signInWithIdToken.mockResolvedValue({ data: {}, error: null });
    mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: null });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should hold the gate while the sign-in is running and release it once the acceptance is recorded", async () => {
    const { result } = await renderHook(useIsTermsGateHeld);
    let finishSignIn: () => void = () => undefined;
    mockSupabaseClient.auth.signInWithIdToken.mockReturnValue(
      new Promise((resolve) => {
        finishSignIn = () => {
          resolve({ data: {}, error: null });
        };
      }),
    );

    const signingIn = signInWithGoogle({ acceptedTermsVersion: TERMS_VERSION });
    await waitFor(() => {
      expect(result.current).toBe(true);
    });

    finishSignIn();
    await act(() => signingIn);

    expect(result.current).toBe(false);
  });

  it("should not hold the gate for a sign-in that records no acceptance", async () => {
    const { result } = await renderHook(useIsTermsGateHeld);
    let heldDuringSignIn = true;
    mockSupabaseClient.auth.signInWithIdToken.mockImplementation(() => {
      heldDuringSignIn = result.current;
      return Promise.resolve({ data: {}, error: null });
    });

    await act(() => signInWithGoogle());

    expect(heldDuringSignIn).toBe(false);
  });

  it("should release the gate when Supabase refuses the token", async () => {
    mockSupabaseClient.auth.signInWithIdToken.mockResolvedValue({
      data: {},
      error: new AuthApiError("Unacceptable audience in id_token", 400, "bad_jwt"),
    });
    const { result } = await renderHook(useIsTermsGateHeld);

    await act(() => signInWithGoogle({ acceptedTermsVersion: TERMS_VERSION }));

    expect(result.current).toBe(false);
  });

  it("should release the gate when the sign-in throws", async () => {
    mockSupabaseClient.auth.signInWithIdToken.mockRejectedValue(new Error("network down"));
    const { result } = await renderHook(useIsTermsGateHeld);

    await act(() => signInWithGoogle({ acceptedTermsVersion: TERMS_VERSION }));

    expect(result.current).toBe(false);
  });

  it("should release the gate when recording the acceptance throws", async () => {
    mockSupabaseClient.rpc.mockRejectedValue(new Error("network down"));
    const { result } = await renderHook(useIsTermsGateHeld);

    await act(() => signInWithGoogle({ acceptedTermsVersion: TERMS_VERSION }));

    expect(result.current).toBe(false);
  });

  it("should release the gate when refreshing the acceptance throws", async () => {
    const { result } = await renderHook(useIsTermsGateHeld);

    await act(() =>
      signInWithGoogle({
        acceptedTermsVersion: TERMS_VERSION,
        refreshTermsAcceptance: () => Promise.reject(new Error("refresh failed")),
      }),
    );

    expect(result.current).toBe(false);
  });
});
