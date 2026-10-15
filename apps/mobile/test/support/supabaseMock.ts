import type { Session } from "@supabase/supabase-js";

type AuthStateListener = (event: string, session: Session | null) => void;

export const mockSupabaseClient = {
  auth: {
    signInWithPassword: jest.fn(),
    signInWithIdToken: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    getSession: jest.fn(),
    onAuthStateChange: jest.fn(),
    exchangeCodeForSession: jest.fn(),
    verifyOtp: jest.fn(),
  },
  rpc: jest.fn(),
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

// More than one part of the app listens (the sign-in gate and the provider that clears its cache).
const authStateListeners = new Set<AuthStateListener>();

export function emitAuthStateChange(event: string, session: Session | null): void {
  for (const listener of authStateListeners) {
    listener(event, session);
  }
}

export function resetSupabaseMock(): void {
  authStateListeners.clear();
  unsubscribeMock.mockReset();
  for (const method of Object.values(mockSupabaseClient.auth)) {
    method.mockReset();
  }
  mockSupabaseClient.rpc.mockReset();
  mockSupabaseClient.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mockSupabaseClient.auth.signOut.mockResolvedValue({ error: null });
  mockSupabaseClient.auth.onAuthStateChange.mockImplementation((listener: AuthStateListener) => {
    authStateListeners.add(listener);
    const unsubscribe = () => {
      authStateListeners.delete(listener);
      unsubscribeMock();
    };
    return { data: { subscription: { unsubscribe } } };
  });
}
