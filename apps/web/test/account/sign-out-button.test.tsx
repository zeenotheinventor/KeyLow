import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SignOutButton } from "@/components/account/SignOutButton";

const { endSession, prefetch, replace } = vi.hoisted(() => ({
  endSession: vi.fn<() => Promise<void>>(),
  prefetch: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ prefetch, replace }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: {} }) }));
vi.mock("@/lib/auth/endSession", () => ({ endSession }));
vi.mock("@/lib/auth/storedSession", () => ({ removeStoredSession: vi.fn() }));

describe("SignOutButton", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    endSession.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it("should end the session and land on the login page", async () => {
    render(<SignOutButton>Sign out</SignOutButton>);

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(replace).toHaveBeenCalledExactlyOnceWith("/login");
    });
    expect(endSession).toHaveBeenCalledOnce();
    expect(prefetch).toHaveBeenCalledWith("/login");
  });
});
