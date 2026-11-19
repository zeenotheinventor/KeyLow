import { isHiddenFromAccessibility, render, screen } from "@testing-library/react-native";

import { AchievementBadge } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";

import type { AchievementBadgeProps } from "../../components/ui";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

async function renderBadges(...badges: AchievementBadgeProps[]) {
  await render(
    <ThemeProvider fixedPreference="dark">
      {badges.map((badge) => (
        <AchievementBadge key={`${badge.id}${badge.state}${badge.size}`} {...badge} />
      ))}
    </ThemeProvider>,
  );
}

// A host node's props are loosely typed, so a prop is read with a descriptor.
function propOf(props: object, name: string): unknown {
  return Object.getOwnPropertyDescriptor(props, name)?.value;
}

function drawn(type: string) {
  return screen.root?.queryAll((node) => node.type === type) ?? [];
}

describe("AchievementBadge", () => {
  describe("accessibility", () => {
    it("should be an image named by its name, tier and state when earned", async () => {
      await renderBadges({ id: "month-strong", size: 96 });

      expect(screen.getByRole("img", { name: "Month Strong, Gold, earned" })).toBeOnTheScreen();
    });

    it("should say how far a locked badge has got", async () => {
      await renderBadges({
        id: "month-strong",
        size: 96,
        state: "locked",
        progress: "12 of 30 days",
      });

      expect(
        screen.getByRole("img", { name: "Month Strong, Gold, locked, 12 of 30 days" }),
      ).toBeOnTheScreen();
    });

    it("should not give away a hidden badge", async () => {
      await renderBadges({ id: "full-circle", size: 96, state: "hidden" });

      expect(screen.getByRole("img", { name: "Hidden badge" })).toBeOnTheScreen();
      expect(screen.queryByRole("img", { name: /Full Circle/ })).not.toBeOnTheScreen();
    });

    it("should be hidden from screen readers when it is decorative", async () => {
      await renderBadges({ id: "month-strong", size: 96, decorative: true });

      const [drawing] = drawn("RNSVGSvgView");

      expect(screen.queryByRole("img")).not.toBeOnTheScreen();
      expect(drawing && isHiddenFromAccessibility(drawing)).toBe(true);
    });
  });

  describe("the drawing", () => {
    it("should draw at the size it is given from the 64 by 64 view box", async () => {
      await renderBadges({ id: "hat-trick", size: 148 });

      const [svg] = drawn("RNSVGSvgView");

      expect(svg?.props.width).toBe(148);
      expect(svg?.props.height).toBe(148);
      expect(svg?.props.vbWidth).toBe(64);
      expect(svg?.props.vbHeight).toBe(64);
    });

    it("should give each badge gradients of its own, so badges on one screen do not share ids", async () => {
      await renderBadges({ id: "month-strong", size: 56 }, { id: "two-months", size: 56 });

      const names = drawn("RNSVGLinearGradient").map((node) => propOf(node.props, "name"));

      expect(names).toHaveLength(4);
      expect(new Set(names).size).toBe(4);
    });

    it("should draw the metal of an earned gold badge in two gradients", async () => {
      await renderBadges({ id: "month-strong", size: 96 });
      expect(drawn("RNSVGLinearGradient")).toHaveLength(2);
    });

    it("should draw no gradients when locked", async () => {
      await renderBadges({ id: "month-strong", size: 96, state: "locked" });

      expect(drawn("RNSVGLinearGradient")).toHaveLength(0);
    });

    it("should write the threshold on the ribbon of a series badge only, not on a one-off", async () => {
      await renderBadges({ id: "fortnight", size: 96 }, { id: "back-on-track", size: 96 });

      expect(drawn("RNSVGText")).toHaveLength(1);
    });
  });
});
