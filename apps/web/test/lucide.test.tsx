import { cleanup, render, screen } from "@testing-library/react";
import { Search } from "lucide-react";
import { afterEach, describe, expect, it } from "vitest";

describe("lucide-react", () => {
  afterEach(() => {
    cleanup();
  });

  it("should render an icon as an svg that is named when given a label", () => {
    render(<Search role="img" aria-label="Search" />);

    expect(screen.getByRole("img", { name: "Search" })).toBeTruthy();
  });
});
