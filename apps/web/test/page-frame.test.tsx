import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { pagePaddingOf } from "./pagePadding";

import { PageFrame } from "@/app/(dashboard)/PageFrame";

function frameAround(content: string) {
  return screen.getByText(content).parentElement;
}

describe("PageFrame", () => {
  afterEach(() => {
    cleanup();
  });

  it("should show what it is given", () => {
    render(
      <PageFrame variant="shell">
        <p>Page content</p>
      </PageFrame>,
    );

    expect(screen.getByText("Page content")).toBeTruthy();
  });

  it.each([
    ["shell", { phone: [24, 24], desktop: [40, 40] }],
    ["foodSearch", { phone: [20, 20], desktop: [32, 32] }],
    ["foodRecord", { phone: [16, 16], desktop: [24, 24] }],
    ["diary", { phone: [16, 16], desktop: [24, 24] }],
    ["targets", { phone: [16, 16], desktop: [32, 32] }],
    ["recipeEditor", { phone: [16, 16], desktop: [24, 24] }],
  ] as const)(
    "should pad the %s family top and bottom as its boards draw it",
    async (variant, expected) => {
      render(
        <PageFrame variant={variant}>
          <p>Page content</p>
        </PageFrame>,
      );

      expect(await pagePaddingOf(frameAround("Page content"))).toEqual(expected);
    },
  );
});
