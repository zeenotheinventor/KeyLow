import { ABOUT_SCREEN, LEGAL_PATHS } from "@keylow/core/copy";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { pagePaddingOf } from "./pagePadding";

import AboutPage from "@/app/(dashboard)/about/page";

const { dataSources } = ABOUT_SCREEN;

describe("About page", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("should be titled About", () => {
    render(<AboutPage />);

    expect(screen.getByRole("heading", { level: 1, name: "About" })).toBeTruthy();
  });

  it("should have a Data sources section", () => {
    render(<AboutPage />);

    expect(screen.getByRole("heading", { level: 2, name: dataSources.title })).toBeTruthy();
  });

  it.each([
    ["CoFID", dataSources.cofid],
    ["Open Food Facts", dataSources.off],
  ])("should credit %s with its name, statement and address", (_label, credit) => {
    render(<AboutPage />);

    const card = screen.getByRole("region", { name: credit.name });
    expect(within(card).getByText(credit.text)).toBeTruthy();
    expect(within(card).getByRole("link", { name: credit.url })).toBeTruthy();
  });

  it.each([
    ["CoFID", dataSources.cofid],
    ["Open Food Facts", dataSources.off],
  ])("should open the %s link in a new tab", (_label, credit) => {
    render(<AboutPage />);

    const link = screen.getByRole("link", { name: credit.url });
    expect(link.getAttribute("href")).toBe(credit.url);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("should have a Legal section after the Data sources section", () => {
    render(<AboutPage />);

    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual([dataSources.title, ABOUT_SCREEN.legal.title]);
  });

  it.each([
    ["Privacy Policy", ABOUT_SCREEN.legal.privacy, LEGAL_PATHS.privacy],
    ["Terms", ABOUT_SCREEN.legal.terms, LEGAL_PATHS.terms],
  ])("should link the %s row to its page on the site", (_label, name, path) => {
    render(<AboutPage />);

    const legal = screen.getByRole("region", { name: ABOUT_SCREEN.legal.title });
    expect(within(legal).getByRole("link", { name }).getAttribute("href")).toBe(path);
  });

  it("should list Privacy Policy before Terms", () => {
    render(<AboutPage />);

    const legal = screen.getByRole("region", { name: ABOUT_SCREEN.legal.title });
    const names = within(legal)
      .getAllByRole("link")
      .map((link) => link.textContent);
    expect(names).toEqual(["Privacy Policy", "Terms"]);
  });

  describe("the version line", () => {
    it("should show the version and the commit the deployment was built from", () => {
      vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678");
      render(<AboutPage />);

      expect(screen.getByText("Version 1.0.0 (a1b2c3d)")).toBeTruthy();
    });

    it("should show only the version when there is no commit, as in local development", () => {
      vi.stubEnv("VERCEL_GIT_COMMIT_SHA", undefined);
      render(<AboutPage />);

      expect(screen.getByText("Version 1.0.0")).toBeTruthy();
    });

    it("should add no heading and no link", () => {
      vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678");
      render(<AboutPage />);

      expect(screen.getAllByRole("heading").map((heading) => heading.textContent)).toEqual([
        "About",
        dataSources.title,
        dataSources.cofid.name,
        dataSources.off.name,
        ABOUT_SCREEN.legal.title,
      ]);
      expect(screen.getAllByRole("link")).toHaveLength(4);
    });
  });

  it("should pad top and bottom as the shell boards draw it", async () => {
    const { container } = render(<AboutPage />);

    expect(await pagePaddingOf(container.firstElementChild)).toEqual({
      phone: [24, 24],
      desktop: [40, 40],
    });
  });
});
