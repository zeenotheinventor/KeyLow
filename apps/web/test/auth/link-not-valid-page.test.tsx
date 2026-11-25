import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import LinkNotValidPage from "@/app/forgot-password/link-not-valid/page";

describe("Reset link not valid page", () => {
  afterEach(() => {
    cleanup();
  });

  it("should tell the person the link is not valid, as an alert", () => {
    render(<LinkNotValidPage />);

    expect(screen.getByRole("alert", { name: "Reset link not valid" })).toBeTruthy();
    expect(screen.getByText(/This link has expired or was already used\./)).toBeTruthy();
    expect(screen.getByText(/in the browser where you asked for it/)).toBeTruthy();
  });

  it("should offer a new link as the main action", () => {
    render(<LinkNotValidPage />);

    expect(screen.getByRole("link", { name: "Send a new link" }).getAttribute("href")).toBe(
      "/forgot-password",
    );
  });

  it("should offer the way back to sign in", () => {
    render(<LinkNotValidPage />);

    expect(screen.getByRole("link", { name: "Back to sign in" }).getAttribute("href")).toBe(
      "/login",
    );
  });
});
