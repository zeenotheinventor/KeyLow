import { cleanup, render, screen } from "@testing-library/react";
import { Mail } from "lucide-react";
import { afterEach, describe, expect, it } from "vitest";

import { AuthMessageCard } from "@/components/auth/AuthMessageCard";

describe("AuthMessageCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("should announce a danger message as an alert named by its title", () => {
    render(<AuthMessageCard tone="danger" icon={Mail} title="Not valid" body="It failed." />);

    expect(screen.getByRole("alert", { name: "Not valid" })).toBeTruthy();
  });

  it.each(["neutral", "success"] as const)("should announce a %s message as a status", (tone) => {
    render(<AuthMessageCard tone={tone} icon={Mail} title="All done" body="Fine." />);

    expect(screen.getByRole("status", { name: "All done" })).toBeTruthy();
  });

  it("should show the title as a heading and the body under it", () => {
    render(<AuthMessageCard tone="neutral" icon={Mail} title="All done" body="Fine." />);

    expect(screen.getByRole("heading", { level: 1, name: "All done" })).toBeTruthy();
    expect(screen.getByText("Fine.")).toBeTruthy();
  });

  it("should draw the icon for the eye only", () => {
    render(<AuthMessageCard tone="neutral" icon={Mail} title="All done" body="Fine." />);

    expect(screen.queryByRole("img")).toBeNull();
  });

  it("should offer the primary and secondary actions as links", () => {
    render(
      <AuthMessageCard
        tone="danger"
        icon={Mail}
        title="Not valid"
        body="It failed."
        primaryAction={{ label: "Try again", href: "/again" }}
        secondaryAction={{ label: "Back", href: "/back" }}
      />,
    );

    expect(screen.getByRole("link", { name: "Try again" }).getAttribute("href")).toBe("/again");
    expect(screen.getByRole("link", { name: "Back" }).getAttribute("href")).toBe("/back");
  });

  it("should draw no actions when none are given", () => {
    render(<AuthMessageCard tone="neutral" icon={Mail} title="All done" body="Fine." />);

    expect(screen.queryByRole("link")).toBeNull();
  });

  it("should keep the buttons and the footer out of the live region", () => {
    render(
      <AuthMessageCard
        tone="neutral"
        icon={Mail}
        title="All done"
        body="Fine."
        secondaryAction={{ label: "Back", href: "/back" }}
        footer={<button type="button">Send again in 45 s</button>}
      />,
    );

    const liveRegion = screen.getByRole("status", { name: "All done" });

    expect(liveRegion.contains(screen.getByRole("heading", { name: "All done" }))).toBe(true);
    expect(liveRegion.contains(screen.getByRole("button", { name: "Send again in 45 s" }))).toBe(
      false,
    );
    expect(liveRegion.contains(screen.getByRole("link", { name: "Back" }))).toBe(false);
  });

  it("should let a long body wrap inside the card", () => {
    const address = `${"a".repeat(80)}@example.com`;
    render(<AuthMessageCard tone="neutral" icon={Mail} title="All done" body={address} />);

    // jsdom does no layout, so the wrapping rule is checked by its class.
    expect(screen.getByText(address).className).toContain("[overflow-wrap:anywhere]");
  });

  it("should draw the footer after the actions", () => {
    render(
      <AuthMessageCard
        tone="neutral"
        icon={Mail}
        title="All done"
        body="Fine."
        secondaryAction={{ label: "Back", href: "/back" }}
        footer={<p>A footer note</p>}
      />,
    );

    const link = screen.getByRole("link", { name: "Back" });
    const footer = screen.getByText("A footer note");

    expect(link.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
