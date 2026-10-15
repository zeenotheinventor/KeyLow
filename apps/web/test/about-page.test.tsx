import { ABOUT_SCREEN } from "@keylow/core/copy";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { pagePaddingOf } from "./pagePadding";

import AboutPage from "@/app/(dashboard)/about/page";

const { dataSources } = ABOUT_SCREEN;

describe("About page", () => {
  afterEach(() => {
    cleanup();
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

  it("should pad top and bottom as the shell boards draw it", async () => {
    const { container } = render(<AboutPage />);

    expect(await pagePaddingOf(container.firstElementChild)).toEqual({
      phone: [24, 24],
      desktop: [40, 40],
    });
  });
});
