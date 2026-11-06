import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SettlingProgressBar } from "@/components/ui/SettlingProgressBar";

afterEach(cleanup);

describe("SettlingProgressBar", () => {
  it("should be a progress bar named by its label and its count", () => {
    render(<SettlingProgressBar label="Days with a weigh-in" count={4} target={8} />);

    const bar = screen.getByRole("progressbar", { name: "Days with a weigh-in, 4 of 8" });
    expect(bar.getAttribute("aria-valuenow")).toBe("4");
    expect(bar.getAttribute("aria-valuemax")).toBe("8");
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
  });

  it("should write the label and the count over the track", () => {
    render(<SettlingProgressBar label="Complete days" count={4} target={10} />);

    expect(screen.getByText("Complete days")).toBeTruthy();
    expect(screen.getByText("4 of 10")).toBeTruthy();
  });

  it("should name the bar by the short name when one is given", () => {
    render(
      <SettlingProgressBar
        label="Days your weigh-ins cover, first to last"
        name="Days your weigh-ins cover"
        count={6}
        target={14}
      />,
    );

    expect(
      screen.getByRole("progressbar", { name: "Days your weigh-ins cover, 6 of 14" }),
    ).toBeTruthy();
  });

  it("should stand alone, named by the label, without a caption", () => {
    render(
      <SettlingProgressBar label="Weigh-ins so far" count={3} target={8} hasCaption={false} />,
    );

    expect(screen.getByRole("progressbar", { name: "Weigh-ins so far" })).toBeTruthy();
    expect(screen.queryByText("3 of 8")).toBeNull();
  });

  it("should hold the bar full past the target and empty below nothing", () => {
    render(
      <>
        <SettlingProgressBar label="Past" count={11} target={8} />
        <SettlingProgressBar label="Below" count={-2} target={8} />
      </>,
    );

    expect(
      screen.getByRole("progressbar", { name: "Past, 8 of 8" }).getAttribute("aria-valuenow"),
    ).toBe("8");
    expect(
      screen.getByRole("progressbar", { name: "Below, 0 of 8" }).getAttribute("aria-valuenow"),
    ).toBe("0");
  });
});
