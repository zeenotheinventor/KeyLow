import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { pagePaddingOf } from "../pagePadding";

import FeatureRequestPage from "@/app/(dashboard)/more/feature-request/page";

vi.mock("@/components/account", () => ({
  FeatureRequestScreen: () => <h1>Request a feature</h1>,
}));

describe("Request a feature page", () => {
  afterEach(() => {
    cleanup();
  });

  it("should draw the request screen", () => {
    render(<FeatureRequestPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Request a feature" })).toBeTruthy();
  });

  it("should pad top and bottom as the shell boards draw it", async () => {
    const { container } = render(<FeatureRequestPage />);

    expect(await pagePaddingOf(container.firstElementChild)).toEqual({
      phone: [24, 24],
      desktop: [40, 40],
    });
  });
});
