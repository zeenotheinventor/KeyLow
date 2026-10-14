import { cleanup, render, screen } from "@testing-library/react";
import { BookOpen } from "lucide-react";
import { afterEach, describe, expect, it } from "vitest";

import { ComingSoon } from "@/app/(dashboard)/ComingSoon";

describe("ComingSoon", () => {
  afterEach(() => {
    cleanup();
  });

  it("should title the page and say it is coming soon", () => {
    render(<ComingSoon title="Diary" />);

    expect(screen.getByRole("heading", { level: 1, name: "Diary" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Coming soon" })).toBeTruthy();
  });

  it("should show the body it is given", () => {
    render(
      <ComingSoon
        title="Diary"
        icon={BookOpen}
        body="Your logged foods will appear here, day by day."
      />,
    );

    expect(screen.getByText("Your logged foods will appear here, day by day.")).toBeTruthy();
  });
});
