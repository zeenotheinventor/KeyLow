import { onlineManager } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SignOutRow } from "@/components/account/SignOutRow";

const { captureException, endSession, prefetch, replace } = vi.hoisted(() => ({
  captureException: vi.fn(),
  endSession: vi.fn<() => Promise<void>>(),
  prefetch: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({ captureException }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ prefetch, replace }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: {} }) }));
vi.mock("@/lib/auth/endSession", () => ({ endSession }));
vi.mock("@/lib/auth/storedSession", () => ({ removeStoredSession: vi.fn() }));

describe("SignOutRow", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    endSession.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    onlineManager.setOnline(true);
  });

  it("should show who is signed in under Sign out", () => {
    render(<SignOutRow email="ada@example.com" />);

    expect(screen.getByRole("button", { name: /Sign out/ }).textContent).toContain(
      "ada@example.com",
    );
  });

  it("should load the login page ahead, so leaving works without a connection", () => {
    render(<SignOutRow email="ada@example.com" />);

    expect(prefetch).toHaveBeenCalledWith("/login");
  });

  it("should end the session and land on the login page", async () => {
    render(<SignOutRow email="ada@example.com" />);

    fireEvent.click(screen.getByRole("button", { name: /Sign out/ }));

    await waitFor(() => {
      expect(replace).toHaveBeenCalledExactlyOnceWith("/login");
    });
    expect(endSession).toHaveBeenCalledOnce();
  });

  it("should land on the login page and show no alert when the browser is offline", async () => {
    onlineManager.setOnline(false);
    render(<SignOutRow email="ada@example.com" />);

    fireEvent.click(screen.getByRole("button", { name: /Sign out/ }));

    await waitFor(() => {
      expect(replace).toHaveBeenCalledExactlyOnceWith("/login");
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("should leave the page only after the session has ended", async () => {
    let finish: () => void = () => undefined;
    endSession.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    render(<SignOutRow email="ada@example.com" />);

    fireEvent.click(screen.getByRole("button", { name: /Sign out/ }));
    fireEvent.click(screen.getByRole("button", { name: /Sign out/ }));

    expect(replace).not.toHaveBeenCalled();
    expect(endSession).toHaveBeenCalledOnce();
    finish();
    await waitFor(() => {
      expect(replace).toHaveBeenCalledOnce();
    });
  });

  it("should report a failure to end the session, stay on the page and leave the row usable", async () => {
    const failure = new Error("storage blocked");
    endSession.mockRejectedValueOnce(failure);
    render(<SignOutRow email="ada@example.com" />);

    fireEvent.click(screen.getByRole("button", { name: /Sign out/ }));

    await waitFor(() => {
      expect(captureException).toHaveBeenCalledExactlyOnceWith(failure);
    });
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Sign out/ }).getAttribute("aria-busy")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Sign out/ }));
    await waitFor(() => {
      expect(replace).toHaveBeenCalledExactlyOnceWith("/login");
    });
  });
});
