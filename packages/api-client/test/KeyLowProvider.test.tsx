import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTestClient } from "./createTestClient";
import { KeyLowProvider, useSupabase } from "../src/KeyLowProvider";

import type { ReactNode } from "react";

afterEach(() => {
  cleanup();
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
    const queryClient = new QueryClient();
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
