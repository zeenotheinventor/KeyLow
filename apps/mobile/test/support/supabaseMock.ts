import type { Session } from "@supabase/supabase-js";

type AuthStateListener = (event: string, session: Session | null) => void;

export const mockSupabaseClient = {
  auth: {
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    getSession: jest.fn(),
    onAuthStateChange: jest.fn(),
    exchangeCodeForSession: jest.fn(),
    verifyOtp: jest.fn(),
  },
};

export const unsubscribeMock = jest.fn();

export const fakeSession: Session = {
  access_token: "access-token",
  refresh_token: "refresh-token",
  expires_in: 3600,
  token_type: "bearer",
  user: {
    id: "user-id",
    aud: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-10-05T00:00:00Z",
  },
};

let authStateListener: AuthStateListener | undefined;

export function emitAuthStateChange(event: string, session: Session | null): void {
  authStateListener?.(event, session);
}

export function resetSupabaseMock(): void {
  authStateListener = undefined;
  unsubscribeMock.mockReset();
  for (const method of Object.values(mockSupabaseClient.auth)) {
    method.mockReset();
  }
  mockSupabaseClient.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mockSupabaseClient.auth.signOut.mockResolvedValue({ error: null });
  mockSupabaseClient.auth.onAuthStateChange.mockImplementation((listener: AuthStateListener) => {
    authStateListener = listener;
    return { data: { subscription: { unsubscribe: unsubscribeMock } } };
  });
}
