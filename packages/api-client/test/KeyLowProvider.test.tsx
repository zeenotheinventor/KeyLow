import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTestClient } from "./createTestClient";
import { createQueryClient } from "./support/queryClients";
import { KeyLowProvider, useSupabase } from "../src/KeyLowProvider";

import type { AuthChangeEvent, Session, SupabaseClient } from "@supabase/supabase-js";
import type { ReactNode } from "react";

afterEach(() => {
  vi.restoreAllMocks();
});

function QueryClientConsumer() {
  const queryClient = useQueryClient();
  return <p>{queryClient instanceof QueryClient ? "query client provided" : "no query client"}</p>;
}

describe("KeyLowProvider", () => {
  it("should render its children", () => {
    render(
      <KeyLowProvider client={createTestClient()}>
        <p>child content</p>
      </KeyLowProvider>,
    );

    expect(screen.queryByText("child content")).not.toBeNull();
  });

  it("should provide a query client to its children", () => {
    render(
      <KeyLowProvider client={createTestClient()}>
        <QueryClientConsumer />
      </KeyLowProvider>,
    );

    expect(screen.queryByText("query client provided")).not.toBeNull();
  });

  it("should provide the query client it was given", () => {
    const queryClient = createQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <KeyLowProvider client={createTestClient()} queryClient={queryClient}>
        {children}
      </KeyLowProvider>
    );

    const { result } = renderHook(() => useQueryClient(), { wrapper });

    expect(result.current).toBe(queryClient);
  });
});

describe("useSupabase", () => {
  it("should return the client passed to the provider", () => {
    const client = createTestClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <KeyLowProvider client={client}>{children}</KeyLowProvider>
    );

    const { result } = renderHook(() => useSupabase(), { wrapper });

    expect(result.current).toBe(client);
  });

  it("should throw when used outside the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => renderHook(() => useSupabase())).toThrow(/KeyLowProvider/);
  });
});

type AuthListener = Parameters<SupabaseClient["auth"]["onAuthStateChange"]>[0];

describe("KeyLowProvider cache and sign-in", () => {
  const sessionOf = (userId: string): Session => ({
    access_token: "access-token",
    refresh_token: "refresh-token",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: userId,
      aud: "authenticated",
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-10-05T00:00:00Z",
    },
  });

  // Captures the listener the provider registers, so a test can play the auth events a phone sees.
  function renderWithAuthEvents() {
    const client = createTestClient();
    const unsubscribe = vi.fn();
    let listener: AuthListener | undefined;
    vi.spyOn(client.auth, "onAuthStateChange").mockImplementation((callback) => {
      listener = callback;
      return { data: { subscription: { id: "test", callback: () => undefined, unsubscribe } } };
    });
    const queryClient = createQueryClient();
    queryClient.setQueryData(["cached"], "value of the first user");
    const resetQueries = vi.spyOn(queryClient, "resetQueries");

    const view = render(
      <KeyLowProvider client={client} queryClient={queryClient}>
        <p>child content</p>
      </KeyLowProvider>,
    );

    const emit = (event: AuthChangeEvent, session: Session | null) => {
      void listener?.(event, session);
    };

    return { emit, queryClient, resetQueries, unsubscribe, view };
  }

  it("should reset the cache when the user signs out", () => {
    const { emit, queryClient, resetQueries } = renderWithAuthEvents();
    emit("INITIAL_SESSION", sessionOf("user-a"));

    emit("SIGNED_OUT", null);

    expect(resetQueries).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(["cached"])).toBeUndefined();
  });

  it("should reset the cache when a different user signs in", () => {
    const { emit, queryClient, resetQueries } = renderWithAuthEvents();
    emit("INITIAL_SESSION", sessionOf("user-a"));

    emit("SIGNED_IN", sessionOf("user-b"));

    expect(resetQueries).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(["cached"])).toBeUndefined();
  });

  it("should keep the cache when the same user is signed in again, as on a token refresh or focus", () => {
    const { emit, queryClient, resetQueries } = renderWithAuthEvents();
    emit("INITIAL_SESSION", sessionOf("user-a"));

    emit("SIGNED_IN", sessionOf("user-a"));
    emit("TOKEN_REFRESHED", sessionOf("user-a"));

    expect(resetQueries).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(["cached"])).toBe("value of the first user");
  });

  it("should keep the cache for the session the app starts with", () => {
    const { emit, queryClient, resetQueries } = renderWithAuthEvents();

    emit("INITIAL_SESSION", sessionOf("user-a"));

    expect(resetQueries).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(["cached"])).toBe("value of the first user");
  });

  it("should refetch a query that is on screen for the next user, not keep showing the last user's data", async () => {
    const { emit, queryClient } = renderWithAuthEvents();
    emit("INITIAL_SESSION", sessionOf("user-a"));
    const answers = ["value of the first user", "value of the second user"];
    let requests = 0;
    const queryFn = () => Promise.resolve(answers[requests++]);
    function CachedValue() {
      const { data } = useQuery({ queryKey: ["on-screen"], queryFn });
      return <p>{data ?? "loading"}</p>;
    }
    render(
      <KeyLowProvider client={createTestClient()} queryClient={queryClient}>
        <CachedValue />
      </KeyLowProvider>,
    );
    await screen.findByText("value of the first user");

    emit("SIGNED_IN", sessionOf("user-b"));

    await waitFor(() => {
      expect(screen.queryByText("value of the second user")).not.toBeNull();
    });
    expect(screen.queryByText("value of the first user")).toBeNull();
  });

  it("should stop listening to auth changes when it unmounts", () => {
    const { unsubscribe, view } = renderWithAuthEvents();

    view.unmount();

    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
