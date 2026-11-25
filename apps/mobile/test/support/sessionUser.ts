import { fakeSession, mockSupabaseClient } from "./supabaseMock";

/** Makes the phone's stored session belong to this address, with the sign in methods the account has. */
export function signInAs(email: string, appMetadata: Record<string, unknown>): void {
  mockSupabaseClient.auth.getSession.mockResolvedValue({
    data: {
      session: { ...fakeSession, user: { ...fakeSession.user, email, app_metadata: appMetadata } },
    },
    error: null,
  });
}

/** The app metadata Supabase gives an account that signs in with an email and a password. */
export const emailAccount = { provider: "email", providers: ["email"] };

/** The app metadata Supabase documents for an account that has only ever signed in with Google. */
export const googleOnlyAccount = { provider: "google", providers: ["google"] };
