import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Badge } from "@/components/ui/Badge";

const lightTextRule = "light-theme:text-text-primary";

const coloredTones = [
  "accent",
  "success",
  "warning",
  "danger",
  "protein",
  "carbs",
  "fat",
  "calories",
] as const;

describe("Badge", () => {
  afterEach(() => {
    cleanup();
  });

  it("should show a status as text", () => {
    render(<Badge tone="warning">Needs review</Badge>);

    expect(screen.getByText("Needs review")).toBeTruthy();
  });

  it.each([
    ["off", "Open Food Facts"],
    ["cofid", "UK CoFID"],
    ["user", "Yours"],
  ] as const)("should name the %s source plainly", (source, name) => {
    render(<Badge kind="source" source={source} />);

    expect(screen.getByText(name)).toBeTruthy();
  });

  it("should draw a dot that screen readers skip when asked", () => {
    render(
      <Badge tone="warning" dot>
        Needs review
      </Badge>,
    );

    const dot = screen.getByText("Needs review").firstElementChild;

    expect(dot?.getAttribute("aria-hidden")).toBe("true");
  });

  it("should draw no dot by default", () => {
    render(<Badge tone="warning">Needs review</Badge>);

    expect(screen.getByText("Needs review").childElementCount).toBe(0);
  });

  describe("light mode", () => {
    it.each(coloredTones)("should keep %s text in the primary text colour", (tone) => {
      render(<Badge tone={tone}>Label</Badge>);

      expect(screen.getByText("Label").className).toContain(lightTextRule);
    });

    it("should not recolour the neutral tone", () => {
      render(<Badge tone="neutral">Estimate</Badge>);

      expect(screen.getByText("Estimate").className).not.toContain(lightTextRule);
    });

    it("should not recolour a source badge", () => {
      render(<Badge kind="source" source="off" />);

      expect(screen.getByText("Open Food Facts").className).not.toContain(lightTextRule);
    });
  });

  describe("props", () => {
    it("should not mix a source badge with a tone or a dot, or a status badge with a source", () => {
      render(
        <>
          {/* @ts-expect-error a source badge has no tone */}
          <Badge kind="source" source="off" tone="warning" />
          {/* @ts-expect-error a source badge has no dot */}
          <Badge kind="source" source="off" dot />
          {/* @ts-expect-error a source badge needs its source */}
          <Badge kind="source" />
          {/* @ts-expect-error a status badge has no source */}
          <Badge tone="warning" source="off">
            Needs review
          </Badge>
          {/* @ts-expect-error a status badge needs its text */}
          <Badge tone="warning" />
        </>,
      );

      expect(screen.getAllByText("Open Food Facts").length).toBeGreaterThan(0);
    });
  });
});
