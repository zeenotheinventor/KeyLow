import { PRIVACY_POLICY, TERMS } from "@keylow/core/copy";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { compileUtilities } from "./ui/compileUtilities";

import PrivacyPage, { metadata as privacyMetadata } from "@/app/privacy/page";
import TermsPage, { metadata as termsMetadata } from "@/app/terms/page";

const pages = [
  ["Privacy Policy", PrivacyPage, privacyMetadata, PRIVACY_POLICY],
  ["Terms of Use", TermsPage, termsMetadata, TERMS],
] as const;

describe.each(pages)("the %s page", (title, Page, metadata, legalDocument) => {
  afterEach(() => {
    cleanup();
  });

  it("should title the browser tab with the document and the app", () => {
    expect(metadata.title).toBe(`${title} | Ki-Lo`);
  });

  it("should be the main landmark, headed by the document title", () => {
    render(<Page />);

    const main = screen.getByRole("main");
    expect(within(main).getByRole("heading", { level: 1, name: title })).toBeTruthy();
  });

  it("should say when it was last updated", () => {
    render(<Page />);

    expect(screen.getByText(legalDocument.lastUpdated)).toBeTruthy();
  });

  it("should give each section a level two heading and its paragraphs", () => {
    render(<Page />);

    for (const section of legalDocument.sections) {
      expect(screen.getByRole("heading", { level: 2, name: section.heading })).toBeTruthy();
      for (const paragraph of section.paragraphs) {
        expect(screen.getAllByText(paragraph).length).toBeGreaterThan(0);
      }
    }
  });

  it("should keep the text to a readable width", async () => {
    render(<Page />);
    const column = screen.getByRole("main").firstElementChild;

    const css = await compileUtilities(column?.getAttribute("class") ?? "");
    expect(css).toContain("max-width: 42rem");
  });
});

describe("the Privacy Policy page", () => {
  afterEach(() => {
    cleanup();
  });

  it("should show every bullet as a list item", () => {
    render(<PrivacyPage />);

    const bulletCount = PRIVACY_POLICY.sections.reduce(
      (count, section) => count + (section.bullets?.length ?? 0),
      0,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(bulletCount);
  });
});
