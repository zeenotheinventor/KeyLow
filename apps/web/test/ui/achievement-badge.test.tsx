import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { AchievementBadgeProps } from "@/components/ui/AchievementBadge";

import { AchievementBadge } from "@/components/ui/AchievementBadge";

function badges(...props: AchievementBadgeProps[]) {
  return (
    <>
      {props.map((badge) => (
        <AchievementBadge key={`${badge.id}${badge.state}${badge.size}`} {...badge} />
      ))}
    </>
  );
}

const gradientIds = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("linearGradient")).map((gradient) => gradient.id);

afterEach(cleanup);

describe("AchievementBadge", () => {
  describe("accessibility", () => {
    it("should be an image named by its name, tier and state when earned", () => {
      render(badges({ id: "month-strong", size: 96 }));

      expect(screen.getByRole("img", { name: "Month Strong, Gold, earned" })).toBeDefined();
    });

    it("should say how far a locked badge has got", () => {
      render(badges({ id: "month-strong", size: 96, state: "locked", progress: "12 of 30 days" }));

      expect(
        screen.getByRole("img", { name: "Month Strong, Gold, locked, 12 of 30 days" }),
      ).toBeDefined();
    });

    it("should not give away a hidden badge", () => {
      render(badges({ id: "full-circle", size: 96, state: "hidden" }));

      expect(screen.getByRole("img", { name: "Hidden badge" })).toBeDefined();
      expect(screen.queryByRole("img", { name: /Full Circle/ })).toBeNull();
    });

    it("should be hidden from assistive technology when it is decorative", () => {
      const { container } = render(badges({ id: "month-strong", size: 96, decorative: true }));

      expect(screen.queryByRole("img")).toBeNull();
      expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    });
  });

  describe("the drawing", () => {
    it("should draw at the size it is given from the 64 by 64 view box", () => {
      render(badges({ id: "hat-trick", size: 148 }));

      const svg = screen.getByRole("img");

      expect(svg.getAttribute("width")).toBe("148");
      expect(svg.getAttribute("height")).toBe("148");
      expect(svg.getAttribute("viewBox")).toBe("0 0 64 64");
    });

    it("should give each badge gradients of its own, so badges on one page do not share ids", () => {
      const { container } = render(
        badges({ id: "month-strong", size: 56 }, { id: "two-months", size: 56 }),
      );

      const ids = gradientIds(container);

      expect(ids).toHaveLength(4);
      expect(new Set(ids).size).toBe(4);
    });

    it("should paint the metal with the gradients it defines", () => {
      const { container } = render(badges({ id: "month-strong", size: 96 }));

      const [firstId] = gradientIds(container);

      expect(container.querySelector(`[fill="url(#${firstId})"]`)).not.toBeNull();
    });

    it("should read its colours from the tier tokens, not from var() in an attribute", () => {
      const { container } = render(badges({ id: "hat-trick", size: 96 }));

      const attributes = Array.from(container.querySelectorAll("*")).flatMap((element) =>
        Array.from(element.attributes)
          .filter((attribute) => attribute.name !== "class")
          .map((attribute) => attribute.value),
      );

      expect(attributes.some((value) => value.includes("var("))).toBe(false);
      expect(container.querySelector(".fill-tier-enamel")).not.toBeNull();
    });

    it("should draw no gradients when locked", () => {
      const { container } = render(badges({ id: "month-strong", size: 96, state: "locked" }));

      expect(gradientIds(container)).toEqual([]);
    });

    it("should leave the beads, the shine and the sparkles off a locked badge", () => {
      const { container } = render(
        badges(
          { id: "fortnight", size: 96, state: "locked" },
          { id: "month-strong", size: 96, state: "locked" },
          { id: "full-circle", size: 96, state: "locked" },
        ),
      );

      expect(container.querySelector('[stroke-width="2.4"]')).toBeNull();
      expect(container.querySelector('[stroke-width="1.6"]')).toBeNull();
      expect(container.querySelector(".fill-tier-plat-b")).toBeNull();
    });

    it("should draw the beads of an earned silver badge", () => {
      const { container } = render(badges({ id: "fortnight", size: 96 }));

      expect(container.querySelector('[stroke-width="2.4"]')).not.toBeNull();
    });

    it("should colour the stops of a gold badge's gradients from the gold tokens", () => {
      const { container } = render(badges({ id: "month-strong", size: 96 }));

      const stops = Array.from(container.querySelectorAll("stop")).map((stop) =>
        stop.getAttribute("class"),
      );

      expect(stops).toEqual([
        "[stop-color:rgb(var(--kl-tier-gold-hi))]",
        "[stop-color:rgb(var(--kl-tier-gold-mid))]",
        "[stop-color:rgb(var(--kl-tier-gold-lo))]",
        "[stop-color:rgb(var(--kl-tier-gold-lo))]",
        "[stop-color:rgb(var(--kl-tier-gold-hi))]",
        "[stop-color:rgb(var(--kl-tier-gold-mid))]",
      ]);
    });

    it("should write the threshold on the ribbon of a series badge and nothing on a one-off", () => {
      render(badges({ id: "fortnight", size: 96 }, { id: "back-on-track", size: 96 }));

      expect(screen.getAllByText("14")).toHaveLength(1);
    });
  });
});
