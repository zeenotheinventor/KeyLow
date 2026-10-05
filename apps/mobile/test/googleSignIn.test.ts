import { Platform } from "react-native";

import { signInWithGoogle } from "../lib/googleSignIn";
import {
  clearGoogleClientIds,
  googleIdToken,
  iosClientId,
  mockGoogleSignin,
  resetGoogleSignInMock,
  webClientId,
} from "./support/googleSignInMock";
import { mockSupabaseClient, resetSupabaseMock } from "./support/supabaseMock";

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: jest.requireActual<{ mockGoogleSignin: unknown }>("./support/googleSignInMock")
    .mockGoogleSignin,
}));
jest.mock("../lib/supabase", () => ({
  supabase: jest.requireActual<{ mockSupabaseClient: unknown }>("./support/supabaseMock")
    .mockSupabaseClient,
}));

const originalEnvironment = { ...process.env };

describe("signInWithGoogle", () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    resetSupabaseMock();
    resetGoogleSignInMock();
    mockSupabaseClient.auth.signInWithIdToken.mockResolvedValue({ data: {}, error: null });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnvironment;
  });

  it("should configure the native module with the client ids from the environment", async () => {
    await signInWithGoogle();

    expect(mockGoogleSignin.configure).toHaveBeenCalledWith({ iosClientId, webClientId });
  });

  it("should exchange the native ID token with Supabase and report a sign-in", async () => {
    const result = await signInWithGoogle();

    expect(mockSupabaseClient.auth.signInWithIdToken).toHaveBeenCalledWith({
      provider: "google",
      token: googleIdToken,
    });
    expect(result).toEqual({ status: "signed-in" });
  });

  it("should open the native sheet before it calls Supabase", async () => {
    await signInWithGoogle();

    expect(mockGoogleSignin.signIn.mock.invocationCallOrder[0]).toBeLessThan(
      mockSupabaseClient.auth.signInWithIdToken.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("should report a cancellation without calling Supabase", async () => {
    mockGoogleSignin.signIn.mockResolvedValue({ type: "cancelled", data: null });

    const result = await signInWithGoogle();

    expect(result).toEqual({ status: "cancelled" });
    expect(mockSupabaseClient.auth.signInWithIdToken).not.toHaveBeenCalled();
  });

  it("should report an error without opening the sheet when the iOS client id is missing", async () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

    const result = await signInWithGoogle();

    expect(result).toEqual({ status: "error", message: "Google sign-in is not configured yet" });
    expect(mockGoogleSignin.signIn).not.toHaveBeenCalled();
  });

  it("should report an error without opening the sheet when the web client id is missing", async () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

    const result = await signInWithGoogle();

    expect(result).toEqual({ status: "error", message: "Google sign-in is not configured yet" });
    expect(mockGoogleSignin.signIn).not.toHaveBeenCalled();
  });

  it("should report an error when both client ids are empty strings", async () => {
    clearGoogleClientIds();
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = "";
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = "";

    const result = await signInWithGoogle();

    expect(result).toEqual({ status: "error", message: "Google sign-in is not configured yet" });
  });

  it("should report an error when the native sheet rejects", async () => {
    mockGoogleSignin.signIn.mockRejectedValue(new Error("DEVELOPER_ERROR"));

    const result = await signInWithGoogle();

    expect(result).toEqual({ status: "error", message: "Google sign-in failed. Try again." });
    expect(mockSupabaseClient.auth.signInWithIdToken).not.toHaveBeenCalled();
  });

  it("should warn with the error object, and never the token, when the native sheet rejects", async () => {
    const nativeError = new Error("DEVELOPER_ERROR");
    mockGoogleSignin.signIn.mockRejectedValue(nativeError);

    await signInWithGoogle();

    expect(warnSpy).toHaveBeenCalledWith("Google sign-in failed", nativeError);
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain(googleIdToken);
  });

  it("should report an error when a successful response carries no ID token", async () => {
    mockGoogleSignin.signIn.mockResolvedValue({ type: "success", data: { idToken: null } });

    const result = await signInWithGoogle();

    expect(result).toEqual({
      status: "error",
      message: "Google did not return an ID token. Try again.",
    });
    expect(mockSupabaseClient.auth.signInWithIdToken).not.toHaveBeenCalled();
  });

  it("should report the Supabase error message when the token exchange fails", async () => {
    mockSupabaseClient.auth.signInWithIdToken.mockResolvedValue({
      data: {},
      error: { message: "Unacceptable audience in id_token" },
    });

    const result = await signInWithGoogle();

    expect(result).toEqual({ status: "error", message: "Unacceptable audience in id_token" });
  });

  it("should report an error when the token exchange throws", async () => {
    mockSupabaseClient.auth.signInWithIdToken.mockRejectedValue(new Error("network down"));

    const result = await signInWithGoogle();

    expect(result).toEqual({ status: "error", message: "Google sign-in failed. Try again." });
  });

  describe("on Android", () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, "OS", "android");
    });

    it("should check Google Play services before it opens the sheet", async () => {
      await signInWithGoogle();

      expect(mockGoogleSignin.hasPlayServices.mock.invocationCallOrder[0]).toBeLessThan(
        mockGoogleSignin.signIn.mock.invocationCallOrder[0] ?? 0,
      );
    });

    it("should report an error when Google Play services are unavailable", async () => {
      mockGoogleSignin.hasPlayServices.mockRejectedValue(new Error("PLAY_SERVICES_NOT_AVAILABLE"));

      const result = await signInWithGoogle();

      expect(result).toEqual({ status: "error", message: "Google sign-in failed. Try again." });
      expect(mockGoogleSignin.signIn).not.toHaveBeenCalled();
    });
  });

  it("should not check Google Play services on iOS", async () => {
    jest.replaceProperty(Platform, "OS", "ios");

    await signInWithGoogle();

    expect(mockGoogleSignin.hasPlayServices).not.toHaveBeenCalled();
  });
});
