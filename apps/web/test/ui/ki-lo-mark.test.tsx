import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { KiLoMark } from "@/components/ui/KiLoMark";

describe("KiLoMark", () => {
  afterEach(() => {
    cleanup();
  });

  it("should be decorative unless it is given a title", () => {
    render(<KiLoMark />);

    expect(screen.queryByRole("img")).toBeNull();
  });

  it("should be named by its title when it stands alone", () => {
    render(<KiLoMark title="Ki-Lo" />);

    expect(screen.getByRole("img", { name: "Ki-Lo" })).toBeTruthy();
  });

  it("should take the size it is given", () => {
    render(<KiLoMark title="Ki-Lo" className="size-12" />);

    expect(screen.getByRole("img", { name: "Ki-Lo" }).classList.contains("size-12")).toBe(true);
  });
});
