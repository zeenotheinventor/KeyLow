import { completeAuthLink } from "../../lib/authLink";
import { mockSupabaseClient, resetSupabaseMock } from "../support/supabaseMock";

jest.mock("../../lib/supabase", () => ({
  supabase: jest.requireActual<{ mockSupabaseClient: unknown }>("../support/supabaseMock")
    .mockSupabaseClient,
}));

describe("completeAuthLink", () => {
  beforeEach(() => {
    resetSupabaseMock();
    mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValue({
      data: { redirectType: null },
      error: null,
    });
    mockSupabaseClient.auth.verifyOtp.mockResolvedValue({ data: {}, error: null });
  });

  describe("with a PKCE code", () => {
    it("should be a recovery when the exchange says the link was a reset", async () => {
      mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValue({
        data: { redirectType: "recovery" },
        error: null,
      });

      await expect(
        completeAuthLink({ code: "pkce-code", tokenHash: undefined, type: undefined }),
      ).resolves.toEqual({ kind: "recovery" });
      expect(mockSupabaseClient.auth.exchangeCodeForSession).toHaveBeenCalledWith("pkce-code");
    });

    it("should be signed in when the exchange has no redirect type", async () => {
      await expect(
        completeAuthLink({ code: "pkce-code", tokenHash: undefined, type: undefined }),
      ).resolves.toEqual({ kind: "signedIn" });
    });

    it("should have failed when the exchange returns an error", async () => {
      mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValue({
        data: { redirectType: "recovery" },
        error: { message: "Code expired" },
      });

      await expect(
        completeAuthLink({ code: "stale", tokenHash: undefined, type: undefined }),
      ).resolves.toEqual({ kind: "failed" });
    });

    it("should have failed when the exchange throws", async () => {
      mockSupabaseClient.auth.exchangeCodeForSession.mockRejectedValue(new Error("network down"));

      await expect(
        completeAuthLink({ code: "pkce-code", tokenHash: undefined, type: undefined }),
      ).resolves.toEqual({ kind: "failed" });
    });
  });

  describe("with a token hash", () => {
    it("should be a recovery for a recovery type", async () => {
      await expect(
        completeAuthLink({ code: undefined, tokenHash: "hash", type: "recovery" }),
      ).resolves.toEqual({ kind: "recovery" });
      expect(mockSupabaseClient.auth.verifyOtp).toHaveBeenCalledWith({
        token_hash: "hash",
        type: "recovery",
      });
    });

    it("should be signed in for any other known type", async () => {
      await expect(
        completeAuthLink({ code: undefined, tokenHash: "hash", type: "email" }),
      ).resolves.toEqual({ kind: "signedIn" });
    });

    it("should have failed when the check returns an error", async () => {
      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({
        data: {},
        error: { message: "Token has expired or is invalid" },
      });

      await expect(
        completeAuthLink({ code: undefined, tokenHash: "hash", type: "recovery" }),
      ).resolves.toEqual({ kind: "failed" });
    });

    it("should have failed when the check throws", async () => {
      mockSupabaseClient.auth.verifyOtp.mockRejectedValue(new Error("network down"));

      await expect(
        completeAuthLink({ code: undefined, tokenHash: "hash", type: "email" }),
      ).resolves.toEqual({ kind: "failed" });
    });

    it("should have failed without calling Supabase for an unknown type", async () => {
      await expect(
        completeAuthLink({ code: undefined, tokenHash: "hash", type: "bogus" }),
      ).resolves.toEqual({ kind: "failed" });
      expect(mockSupabaseClient.auth.verifyOtp).not.toHaveBeenCalled();
    });
  });

  it("should have failed with no parameters", async () => {
    await expect(
      completeAuthLink({ code: undefined, tokenHash: undefined, type: undefined }),
    ).resolves.toEqual({ kind: "failed" });
  });

  it("should have failed for the error link of an expired reset, which carries no code or hash", async () => {
    // The route only reads code, token_hash and type, so error and error_code arrive as nothing.
    await expect(
      completeAuthLink({ code: undefined, tokenHash: undefined, type: undefined }),
    ).resolves.toEqual({ kind: "failed" });
    expect(mockSupabaseClient.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(mockSupabaseClient.auth.verifyOtp).not.toHaveBeenCalled();
  });
});
