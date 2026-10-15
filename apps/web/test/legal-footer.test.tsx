import { COMPANY_DETAILS, LEGAL_FOOTER } from "@keylow/core/copy";
import { touchTarget } from "@keylow/tokens";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { compileUtilities } from "./ui/compileUtilities";

import { LegalFooter } from "@/components/legal/LegalFooter";

describe("LegalFooter", () => {
  afterEach(() => {
    cleanup();
  });

  it("should be the page's content information landmark", () => {
    render(<LegalFooter />);

    expect(screen.getByRole("contentinfo")).toBeTruthy();
  });

  it("should say who runs Ki-Lo, with the company number and registered office", () => {
    render(<LegalFooter />);

    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByText(LEGAL_FOOTER.companyLine)).toBeTruthy();
    expect(LEGAL_FOOTER.companyLine).toContain(COMPANY_DETAILS.companyNumber);
  });

  it("should link to the Privacy Policy and the Terms of Use", () => {
    render(<LegalFooter />);

    const legal = screen.getByRole("navigation", { name: "Legal" });
    expect(within(legal).getByRole("link", { name: "Privacy Policy" }).getAttribute("href")).toBe(
      "/privacy",
    );
    expect(within(legal).getByRole("link", { name: "Terms of Use" }).getAttribute("href")).toBe(
      "/terms",
    );
  });

  it("should make each link at least as tall as a touch target", async () => {
    render(<LegalFooter />);

    for (const link of screen.getAllByRole("link")) {
      const css = await compileUtilities(link.getAttribute("class") ?? "");
      expect(css).toContain(`min-height: ${touchTarget}px`);
    }
  });

  it("should draw the company line as caption text in the secondary text colour", () => {
    render(<LegalFooter />);

    const className = screen.getByText(LEGAL_FOOTER.companyLine).getAttribute("class") ?? "";
    expect(className).toContain("text-caption");
    expect(className).toContain("text-text-secondary");
  });
});
