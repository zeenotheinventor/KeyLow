import { FOOD_DETAIL } from "@keylow/core/copy";
import { controlHeight, touchTarget } from "@keylow/tokens";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { compileUtilities } from "./compileUtilities";
import { asPattern, pixelsOf, reachOf } from "./hitArea";

import { BackToFoodsLink } from "@/components/foods/FoodDetail/BackToFoodsLink";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { SearchField, SearchLauncher } from "@/components/ui/SearchField";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Toast } from "@/components/ui/Toast";

// The kit has controls drawn under 44 px (the dense 36 px height, a 28 px or 36 px icon button). Each one
// reaches a 44 px target without changing how it looks: an invisible `::after` that sits past its edges, or
// for a text field a box that is 44 px high behind its 36 px frame. jsdom cannot measure a box, so these tests
// compile the classes an element carries with the app's own Tailwind config, read how far its `::after`
// reaches past each edge, and add that to the drawn size. The drawn sizes themselves are pinned in
// control-sizes.test.tsx, and the real boxes are measured in a browser (see the pull request).

/** The declaration Tailwind writes for one class, such as `height: 44px`, or an empty string. */
async function declarationOf(element: HTMLElement, token: string): Promise<string> {
  const css = await compileUtilities(element.className);
  const selector = `.${token.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`)}`;
  const rule = new RegExp(`${asPattern(selector)}\\s*\\{([^}]*)\\}`).exec(css);
  return rule?.[1]?.replace(/\s+/g, " ").trim() ?? "";
}

const classesOf = (element: HTMLElement): string[] => element.className.split(/\s+/);

const noop = () => undefined;

// The button and the chip draw a 1 px border, which their pseudo element is placed inside.
const buttonBorderWidth = 1;
const chipBorderWidth = 1;

// The widths a browser draws the narrowest chip ("g") and the narrowest trailing action (a word such as
// "Copy") at, which are under a touch target, so their reach has to make up the rest sideways.
const narrowestChipWidth = 36;
const narrowestBannerActionWidth = 35;

afterEach(() => {
  cleanup();
});

describe("Button", () => {
  it("should reach a touch target high from its small height when it is a text button", async () => {
    render(<Button size="sm">Done</Button>);
    const button = screen.getByRole("button", { name: "Done" });
    const reach = await reachOf(button, "after:", buttonBorderWidth);

    expect(classesOf(button)).toEqual(expect.arrayContaining(["relative", "after:absolute"]));
    expect(controlHeight.sm + reach.top + reach.bottom).toBe(touchTarget);
  });

  it.each(["primary", "secondary", "destructive", "ghost", "default", "outline"] as const)(
    "should reach a touch target high in its %s variant when small",
    async (variant) => {
      render(
        <Button size="sm" variant={variant}>
          Done
        </Button>,
      );
      const reach = await reachOf(
        screen.getByRole("button", { name: "Done" }),
        "after:",
        buttonBorderWidth,
      );

      expect(controlHeight.sm + reach.top + reach.bottom).toBe(touchTarget);
    },
  );

  it("should reach a touch target high when small and icon only", async () => {
    render(<Button size="sm" iconOnly aria-label="Add" />);
    const reach = await reachOf(
      screen.getByRole("button", { name: "Add" }),
      "after:",
      buttonBorderWidth,
    );

    expect(controlHeight.sm + reach.top + reach.bottom).toBe(touchTarget);
  });

  it("should draw the hover tint with the button's own corners, whatever radius a screen gives it", () => {
    render(
      <Button size="sm" className="rounded-small">
        Done
      </Button>,
    );
    const classes = classesOf(screen.getByRole("button", { name: "Done" }));

    expect(classes).toContain("before:rounded-[inherit]");
    expect(classes).toContain("rounded-small");
    expect(classes).not.toContain("rounded-medium");
  });

  it("should not clip the reach of a small button", () => {
    render(<Button size="sm">Done</Button>);

    expect(classesOf(screen.getByRole("button", { name: "Done" }))).not.toContain(
      "overflow-hidden",
    );
  });

  it.each(["md", "lg", "default"] as const)(
    "should keep clipping the hover tint to the corners of its %s size, which needs no reach",
    (size) => {
      render(<Button size={size}>Done</Button>);
      const button = screen.getByRole("button", { name: "Done" });

      expect(classesOf(button)).toContain("overflow-hidden");
      expect(classesOf(button).some((name) => name.startsWith("after:-inset"))).toBe(false);
    },
  );

  it("should leave the ring variant's drawn circle alone when small", () => {
    render(<Button size="sm" variant="ring" iconOnly aria-label="Add" />);
    const classes = classesOf(screen.getByRole("button", { name: "Add" }));

    expect(classes).toContain("after:inset-1.5");
    expect(classes.some((name) => name.startsWith("after:-inset"))).toBe(false);
  });
});

describe("SearchField", () => {
  it.each(["sm", "md"] as const)(
    "should take a touch target high for the input of its %s size",
    async (size) => {
      render(<SearchField label="Search foods" size={size} />);
      const input = screen.getByRole("searchbox", { name: "Search foods" });

      expect(await declarationOf(input, "h-touch-target")).toBe(`height: ${touchTarget}px`);
    },
  );

  it.each([
    ["sm", 28],
    ["md", 36],
  ] as const)(
    "should reach a touch target square from the barcode button of its %s size",
    async (size, drawnSide) => {
      render(
        <SearchField
          label="Search foods"
          size={size}
          barcodeButton={{ label: "Look up a barcode", onClick: noop }}
        />,
      );
      const reach = await reachOf(screen.getByRole("button", { name: "Look up a barcode" }));

      expect(classesOf(screen.getByRole("button", { name: "Look up a barcode" }))).toEqual(
        expect.arrayContaining(["relative", "after:absolute"]),
      );
      expect(drawnSide + reach.left + reach.right).toBe(touchTarget);
      expect(drawnSide + reach.top + reach.bottom).toBe(touchTarget);
    },
  );

  it.each(["sm", "md"] as const)(
    "should not let the clear button and the barcode button of its %s size reach into each other",
    async (size) => {
      render(
        <SearchField
          label="Search recipes"
          size={size}
          value="chi"
          onChange={noop}
          clear={{ label: "Clear search", onClick: noop }}
          barcodeButton={{ label: "Look up a barcode", onClick: noop }}
        />,
      );
      const frame = screen.getByRole("search");
      const gap = pixelsOf(
        /gap: ([^;]+)/.exec(await compileUtilities(frame.className))?.[1] ?? "0",
      );
      const clearReach = await reachOf(screen.getByRole("button", { name: "Clear search" }));
      const barcodeReach = await reachOf(screen.getByRole("button", { name: "Look up a barcode" }));

      expect(gap).toBeGreaterThan(0);
      expect(clearReach.right + barcodeReach.left).toBeLessThanOrEqual(gap);
    },
  );

  it("should reach a touch target square from the clear button", async () => {
    render(
      <SearchField
        label="Search recipes"
        value="chi"
        onChange={noop}
        clear={{ label: "Clear search", onClick: noop }}
      />,
    );
    const clear = screen.getByRole("button", { name: "Clear search" });
    const reach = await reachOf(clear);

    expect(classesOf(clear)).toEqual(expect.arrayContaining(["relative", "after:absolute"]));
    expect(controlHeight.sm + reach.left + reach.right).toBe(touchTarget);
    expect(controlHeight.sm + reach.top + reach.bottom).toBe(touchTarget);
  });
});

describe("SearchLauncher", () => {
  it.each(["sm", "md", "adaptive"] as const)(
    "should take a touch target high for the button of its %s size",
    async (size) => {
      render(<SearchLauncher label="Search for a food" onSearch={noop} size={size} />);
      const launcher = screen.getByRole("button", { name: "Search for a food" });

      expect(await declarationOf(launcher, "h-touch-target")).toBe(`height: ${touchTarget}px`);
    },
  );

  it.each([
    ["sm", "after:", 28],
    ["md", "after:", 36],
    ["adaptive", "after:", 36],
    ["adaptive", "lg:after:", 28],
  ] as const)(
    "should reach a touch target square from the barcode button of its %s size (%s)",
    async (size, prefix, drawnSide) => {
      render(
        <SearchLauncher
          label="Search for a food"
          onSearch={noop}
          size={size}
          barcodeButton={{ label: "Look up a barcode", onClick: noop }}
        />,
      );
      const reach = await reachOf(
        screen.getByRole("button", { name: "Look up a barcode" }),
        prefix,
      );

      expect(drawnSide + reach.left + reach.right).toBe(touchTarget);
      expect(drawnSide + reach.top + reach.bottom).toBe(touchTarget);
    },
  );
});

describe("ChipGroup", () => {
  const options: { value: string; label: string }[] = [
    { value: "g", label: "g" },
    { value: "ml", label: "ml" },
  ];

  it("should reach a touch target high from each chip", async () => {
    render(<ChipGroup label="Unit" options={options} value="g" onChange={noop} />);

    for (const chip of screen.getAllByRole("radio")) {
      const reach = await reachOf(chip, "after:", chipBorderWidth);
      expect(classesOf(chip)).toEqual(expect.arrayContaining(["relative", "after:absolute"]));
      expect(controlHeight.sm + reach.top + reach.bottom).toBe(touchTarget);
    }
  });

  it("should reach a touch target high from each chip when several can be chosen", async () => {
    render(
      <ChipGroup selection="multiple" label="Unit" options={options} value={[]} onChange={noop} />,
    );

    for (const chip of screen.getAllByRole("checkbox")) {
      const reach = await reachOf(chip, "after:", chipBorderWidth);
      expect(controlHeight.sm + reach.top + reach.bottom).toBe(touchTarget);
    }
  });

  it("should reach far enough sideways for the narrowest chip to be a touch target wide", async () => {
    render(<ChipGroup label="Unit" options={options} value="g" onChange={noop} />);
    const reach = await reachOf(
      screen.getByRole("radio", { name: "g" }),
      "after:",
      chipBorderWidth,
    );

    expect(narrowestChipWidth + reach.left + reach.right).toBeGreaterThanOrEqual(touchTarget);
  });

  it("should not let the reach of one chip pass the middle of the gap to the next", async () => {
    render(<ChipGroup label="Unit" options={options} value="g" onChange={noop} />);
    const group = screen.getByRole("radiogroup", { name: "Unit" });
    const gap = pixelsOf(/gap: ([^;]+)/.exec(await compileUtilities(group.className))?.[1] ?? "0");
    const reach = await reachOf(
      screen.getByRole("radio", { name: "g" }),
      "after:",
      chipBorderWidth,
    );

    expect(gap).toBeGreaterThan(0);
    expect(reach.right + reach.left).toBeLessThanOrEqual(gap);
    expect(reach.top + reach.bottom).toBeLessThanOrEqual(gap);
  });
});

describe("Banner", () => {
  it("should reach a touch target high from a trailing action", async () => {
    render(
      <Banner tone="review" action={{ label: "Copy to your foods", onClick: noop }}>
        Energy is not given.
      </Banner>,
    );
    const action = screen.getByRole("button", { name: "Copy to your foods" });
    const reach = await reachOf(action);

    expect(classesOf(action)).toEqual(expect.arrayContaining(["relative", "after:absolute"]));
    expect(controlHeight.sm + reach.top + reach.bottom).toBe(touchTarget);
  });

  it("should reach far enough sideways for the narrowest action to be a touch target wide", async () => {
    render(
      <Banner tone="review" action={{ label: "Copy", onClick: noop }}>
        Energy is not given.
      </Banner>,
    );
    const reach = await reachOf(screen.getByRole("button", { name: "Copy" }));

    expect(narrowestBannerActionWidth + reach.left + reach.right).toBeGreaterThanOrEqual(
      touchTarget,
    );
  });

  it("should reach a touch target high from a trailing action that is a link", async () => {
    render(
      <Banner tone="error" action={{ label: "Try again", href: "/foods" }}>
        Not saved.
      </Banner>,
    );
    const reach = await reachOf(screen.getByRole("link", { name: "Try again" }));

    expect(controlHeight.sm + reach.top + reach.bottom).toBe(touchTarget);
  });

  it.each([
    ["info", 24],
    ["review", 20],
    ["error", 20],
  ] as const)(
    "should reach a touch target high from the action below the words of a %s banner",
    async (tone, lineHeight) => {
      render(
        <Banner
          tone={tone}
          title="Heads up"
          actionPlacement="below"
          action={{ label: "Open settings", onClick: noop }}
        >
          Something to know.
        </Banner>,
      );
      const action = screen.getByRole("button", { name: "Open settings" });
      const reach = await reachOf(action);

      expect(classesOf(action)).toEqual(expect.arrayContaining(["relative", "after:absolute"]));
      expect(lineHeight + reach.top + reach.bottom).toBe(touchTarget);
    },
  );
});

describe("Toast", () => {
  it("should reach a touch target high from its action", async () => {
    render(<Toast message="Entry deleted" actionLabel="Undo" onAction={noop} />);
    const action = screen.getByRole("button", { name: "Undo" });
    const reach = await reachOf(action);

    expect(classesOf(action)).toEqual(expect.arrayContaining(["relative", "after:absolute"]));
    expect(controlHeight.sm + reach.top + reach.bottom).toBe(touchTarget);
  });
});

describe("BackToFoodsLink", () => {
  it("should reach a touch target high from the quiet link", async () => {
    render(<BackToFoodsLink />);
    const link = screen.getByRole("link", { name: FOOD_DETAIL.back });
    const reach = await reachOf(link);

    expect(classesOf(link)).toEqual(expect.arrayContaining(["relative", "after:absolute"]));
    expect(controlHeight.sm + reach.top + reach.bottom).toBe(touchTarget);
  });

  it("should add no reach to the accent link, which is already a touch target high", () => {
    render(<BackToFoodsLink tone="accent" />);

    expect(classesOf(screen.getByRole("link", { name: FOOD_DETAIL.back })).join(" ")).not.toContain(
      "after:",
    );
  });
});

describe("SegmentedControl", () => {
  const options = [
    { value: "primary", label: "Primary" },
    { value: "second", label: "Second" },
  ] as const;

  it("should reach a touch target high from each segment of the small size", async () => {
    render(
      <SegmentedControl size="sm" label="Role" options={options} value="primary" onChange={noop} />,
    );
    // The segment is the label that holds the radio: the track less its 1 px border and 2 px of padding.
    const segmentHeight = controlHeight.sm - 2 * 1 - 2 * 2;

    for (const radio of screen.getAllByRole("radio")) {
      const segment = radio.closest("label");
      if (segment === null) throw new Error("A radio of the control has no label around it");
      const reach = await reachOf(segment);

      expect(classesOf(segment)).toEqual(expect.arrayContaining(["relative", "after:absolute"]));
      expect(segmentHeight + reach.top + reach.bottom).toBe(touchTarget);
      // Segments touch, so the reach goes up and down only.
      expect(reach.left + reach.right).toBe(0);
    }
  });
});
