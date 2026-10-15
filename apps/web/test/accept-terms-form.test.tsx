import { TERMS_VERSION } from "@keylow/core/copy";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AcceptTermsForm } from "@/app/accept-terms/AcceptTermsForm";

const { rpc, push, refresh } = vi.hoisted(() => ({
  rpc: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const GENERIC_ERROR = "Something went wrong. Try again.";
const continueButton = () => screen.getByRole("button", { name: "Continue" });
const tickBox = () => {
  fireEvent.click(screen.getByRole("checkbox"));
};

describe("AcceptTermsForm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    rpc.mockResolvedValue({ data: null, error: null });
  });

  afterEach(() => {
    cleanup();
  });

  it("should keep Continue disabled until the box is ticked", () => {
    render(<AcceptTermsForm />);

    expect(continueButton().hasAttribute("disabled")).toBe(true);

    tickBox();

    expect(continueButton().hasAttribute("disabled")).toBe(false);
  });

  it("should disable Continue again when the box is unticked", () => {
    render(<AcceptTermsForm />);

    tickBox();
    tickBox();

    expect(continueButton().hasAttribute("disabled")).toBe(true);
  });

  it("should record the current Terms version and go to the dashboard", async () => {
    render(<AcceptTermsForm />);

    tickBox();
    fireEvent.click(continueButton());

    await waitFor(() => {
      expect(push).toHaveBeenCalledExactlyOnceWith("/dashboard");
    });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("accept_terms", { p_version: TERMS_VERSION });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("should make Continue usable again when the page is still showing after the navigation", async () => {
    render(<AcceptTermsForm />);

    tickBox();
    fireEvent.click(continueButton());

    await waitFor(() => {
      expect(push).toHaveBeenCalledOnce();
    });
    await waitFor(() => {
      expect(continueButton().getAttribute("aria-busy")).toBeNull();
    });
    expect(continueButton().hasAttribute("disabled")).toBe(false);
  });

  it("should not record anything before the box is ticked", () => {
    render(<AcceptTermsForm />);

    fireEvent.submit(continueButton());

    expect(rpc).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("should show a fixed sentence and stay on the page when recording fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "P0002", message: "no profile row" } });
    render(<AcceptTermsForm />);

    tickBox();
    fireEvent.click(continueButton());

    expect(await screen.findByText(GENERIC_ERROR)).toBeTruthy();
    expect(screen.queryByText(/no profile row/)).toBeNull();
    expect(push).not.toHaveBeenCalled();
    expect(continueButton().hasAttribute("disabled")).toBe(false);
  });

  it("should show the fixed sentence when the request itself throws", async () => {
    rpc.mockRejectedValue(new Error("network down"));
    render(<AcceptTermsForm />);

    tickBox();
    fireEvent.click(continueButton());

    expect(await screen.findByText(GENERIC_ERROR)).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });
});
