import { AppState } from "react-native";

import { LargeSecureStore } from "../lib/LargeSecureStore";

import type { AppStateStatus } from "react-native";

const mockAuth = { startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() };
const mockCreateClient = jest.fn((..._arguments: unknown[]) => ({ auth: mockAuth }));

jest.mock("@supabase/supabase-js", () => ({
  createClient: (...clientArguments: unknown[]) => mockCreateClient(...clientArguments),
}));
jest.mock("../lib/LargeSecureStore", () => ({ LargeSecureStore: jest.fn() }));

const originalEnvironment = { ...process.env };

function loadSupabaseModule(): void {
  jest.isolateModules(() => {
    jest.requireActual<object>("../lib/supabase");
  });
}

describe("supabase client", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockAuth.startAutoRefresh.mockReset();
    mockAuth.stopAutoRefresh.mockReset();
    mockCreateClient.mockClear();
    process.env.EXPO_PUBLIC_SUPABASE_URL = "http://192.168.1.10:54321";
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "publishable-key";
  });

  afterAll(() => {
    process.env = originalEnvironment;
  });

  it("should throw a clear error when the URL is missing", () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;

    expect(loadSupabaseModule).toThrow("EXPO_PUBLIC_SUPABASE_URL");
  });

  it("should throw a clear error when the anon key is missing", () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    expect(loadSupabaseModule).toThrow("EXPO_PUBLIC_SUPABASE_ANON_KEY");
  });

  it("should create the client with PKCE, persisted sessions and no URL detection", () => {
    loadSupabaseModule();

    const [url, key, options] = mockCreateClient.mock.calls[0] ?? [];
    const [storage] = jest.mocked(LargeSecureStore).mock.instances;
    expect(url).toBe("http://192.168.1.10:54321");
    expect(key).toBe("publishable-key");
    expect(options).toMatchObject({
      auth: {
        storage,
        flowType: "pkce",
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  });

  it("should start auto-refresh when the app becomes active and stop it in the background", () => {
    let notify: (state: AppStateStatus) => void = () => undefined;
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
      notify = listener;
      return { remove: jest.fn() };
    });
    loadSupabaseModule();

    notify("active");
    notify("background");

    expect(mockAuth.startAutoRefresh).toHaveBeenCalledTimes(1);
    expect(mockAuth.stopAutoRefresh).toHaveBeenCalledTimes(1);
  });
});
