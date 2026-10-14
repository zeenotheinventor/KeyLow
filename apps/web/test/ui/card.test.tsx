import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Card } from "@/components/ui/card";

describe("Card", () => {
  afterEach(() => {
    cleanup();
  });

  it("should show its children", () => {
    render(<Card>Entry added</Card>);

    expect(screen.getByText("Entry added")).toBeTruthy();
  });

  it("should show a title as a level two heading", () => {
    render(<Card title="Today">Entry added</Card>);

    expect(screen.getByRole("heading", { level: 2, name: "Today" })).toBeTruthy();
  });

  it("should sit on the surface by default and on a raised surface when told", () => {
    render(
      <>
        <Card aria-label="Plain" role="region" />
        <Card aria-label="Raised" role="region" level="raised" />
      </>,
    );

    expect(screen.getByRole("region", { name: "Plain" }).className).toContain("bg-surface");
    expect(screen.getByRole("region", { name: "Plain" }).className).not.toContain("raised");
    expect(screen.getByRole("region", { name: "Raised" }).className).toContain("bg-surface-raised");
  });

  it("should take the padding of the design, and none when told", () => {
    render(
      <>
        <Card aria-label="Padded" role="region" />
        <Card aria-label="Bare" role="region" padding="none" />
      </>,
    );

    expect(screen.getByRole("region", { name: "Padded" }).className).toContain("p-4");
    expect(screen.getByRole("region", { name: "Bare" }).className).not.toContain("p-4");
  });

  it("should become the element it is given with asChild", () => {
    render(
      <Card asChild>
        <section aria-label="Barcode lookup">Look up</section>
      </Card>,
    );

    const section = screen.getByRole("region", { name: "Barcode lookup" });

    expect(section.textContent).toBe("Look up");
    expect(section.className).toContain("rounded-large");
  });
});
