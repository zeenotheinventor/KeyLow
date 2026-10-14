import { BARCODE_NOT_FOUND, FOOD_DETAIL, FOOD_FORM } from "@keylow/core/copy";
import { controlHeight, pressScale, touchTarget } from "@keylow/tokens";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { compileUtilities } from "./compileUtilities";

import { DashboardNav } from "@/app/(dashboard)/DashboardNav";
import { BarcodeResult } from "@/components/foods/BarcodeLookup/BarcodeResult";
import { BackToFoodsLink } from "@/components/foods/FoodDetail/BackToFoodsLink";
import { FormActions } from "@/components/foods/FoodForm/FormActions";
import { Banner } from "@/components/ui/Banner";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { GroupedList } from "@/components/ui/GroupedList";
import { Input } from "@/components/ui/Input";
import { NumericInput } from "@/components/ui/NumericInput";
import { SearchField, SearchLauncher } from "@/components/ui/SearchField";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

// The kit sizes its controls with the shared classes (`h-control-md`, `min-h-touch-target`,
// `active:scale-press`) instead of a literal. These tests compile the classes an element carries
// with the app's own Tailwind config and read the declaration each one becomes, so they prove the
// sizes on screen are still the design's numbers and that the shared classes reach the app.

vi.mock("next/navigation", () => ({
  usePathname: () => "/diary",
  useRouter: () => ({ push: vi.fn() }),
}));

const escapeForPattern = (text: string): string => text.replace(/[.*+?^${}()|[\]\\:]/g, "\\$&");

/** The declarations Tailwind generates for one class, e.g. `height: 44px`, or an empty string. */
async function declarationsOf(classNames: string, className: string): Promise<string> {
  const css = await compileUtilities(classNames);
  const rule = new RegExp(`\\.${escapeForPattern(className)}(?::[a-z-]+)?\\s*\\{([^}]*)\\}`).exec(
    css,
  );
  return rule?.[1]?.replace(/\s+/g, " ").trim() ?? "";
}

afterEach(() => {
  cleanup();
});

describe("Button", () => {
  it.each([
    ["sm", controlHeight.sm],
    ["md", controlHeight.md],
    ["lg", controlHeight.lg],
    ["default", controlHeight.md],
  ] as const)("should be as high as the control height of its %s size", async (size, pixels) => {
    render(<Button size={size}>Add entry</Button>);
    const { className } = screen.getByRole("button", { name: "Add entry" });

    expect(await declarationsOf(className, `h-control-${size === "default" ? "md" : size}`)).toBe(
      `height: ${pixels}px`,
    );
  });

  it.each([
    ["sm", "w-control-sm", controlHeight.sm],
    ["md", "w-control-md", controlHeight.md],
    ["lg", "w-control-lg", controlHeight.lg],
    ["default", "w-control-md", controlHeight.md],
  ] as const)(
    "should be square when icon only in its %s size",
    async (size, widthClass, pixels) => {
      const classNames = buttonVariants({ size, iconOnly: true });

      expect(classNames).toContain(widthClass);
      expect(await declarationsOf(classNames, widthClass)).toBe(`width: ${pixels}px`);
    },
  );

  it("should never be narrower than a touch target", async () => {
    render(<Button size="sm">Add entry</Button>);
    const { className } = screen.getByRole("button", { name: "Add entry" });

    expect(await declarationsOf(className, "min-w-touch-target")).toBe(
      `min-width: ${touchTarget}px`,
    );
  });

  it("should compress to the press scale while pressed", async () => {
    render(<Button>Add entry</Button>);
    const { className } = screen.getByRole("button", { name: "Add entry" });

    expect(await declarationsOf(className, "active\\:scale-press")).toBe(
      `--tw-scale-x: ${pressScale}; --tw-scale-y: ${pressScale}; transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))`,
    );
  });
});

describe("Input", () => {
  it("should be as high as the medium control height", async () => {
    render(<Input aria-label="Name" />);
    const { className } = screen.getByRole("textbox", { name: "Name" });

    expect(await declarationsOf(className, "h-control-md")).toBe(`height: ${controlHeight.md}px`);
  });
});

describe("NumericInput", () => {
  it("should draw its frame as high as the medium control height", async () => {
    render(<NumericInput label="Energy" unit="kcal" />);
    const frameClassName = screen.getByRole("textbox").parentElement?.className ?? "";

    expect(await declarationsOf(frameClassName, "h-control-md")).toBe(
      `height: ${controlHeight.md}px`,
    );
  });
});

describe("SearchField", () => {
  it.each([
    ["md", "h-control-md", controlHeight.md],
    ["sm", "h-control-sm", controlHeight.sm],
  ] as const)("should be as high as the %s control height", async (size, heightClass, pixels) => {
    render(<SearchField label="Search foods" size={size} />);
    const { className } = screen.getByRole("search");

    expect(await declarationsOf(className, heightClass)).toBe(`height: ${pixels}px`);
  });
});

describe("SearchLauncher", () => {
  it.each([
    ["md", "h-control-md", controlHeight.md],
    ["sm", "h-control-sm", controlHeight.sm],
  ] as const)("should be as high as the %s control height", async (size, heightClass, pixels) => {
    render(<SearchLauncher label="Search for a food" onSearch={() => undefined} size={size} />);
    const frameClassName =
      screen.getByRole("button", { name: "Search for a food" }).parentElement?.className ?? "";

    expect(await declarationsOf(frameClassName, heightClass)).toBe(`height: ${pixels}px`);
  });

  it("should drop from the medium to the small control height at the large breakpoint when adaptive", async () => {
    render(<SearchLauncher label="Search for a food" onSearch={() => undefined} size="adaptive" />);
    const frameClassName =
      screen.getByRole("button", { name: "Search for a food" }).parentElement?.className ?? "";

    expect(await declarationsOf(frameClassName, "h-control-md")).toBe(
      `height: ${controlHeight.md}px`,
    );
    expect(await declarationsOf(frameClassName, "lg\\:h-control-sm")).toBe(
      `height: ${controlHeight.sm}px`,
    );
  });
});

describe("SegmentedControl", () => {
  it("should be as high as the medium control height", async () => {
    render(
      <SegmentedControl
        label="Appearance"
        options={[{ value: "dark", label: "Dark" }]}
        value="dark"
        onChange={() => undefined}
      />,
    );
    const { className } = screen.getByRole("radiogroup", { name: "Appearance" });

    expect(await declarationsOf(className, "h-control-md")).toBe(`height: ${controlHeight.md}px`);
  });
});

describe("Checkbox", () => {
  it("should be at least a touch target high", async () => {
    render(<Checkbox label="Default portion" />);
    const labelClassName =
      screen.getByRole("checkbox", { name: "Default portion" }).parentElement?.className ?? "";

    expect(await declarationsOf(labelClassName, "min-h-touch-target")).toBe(
      `min-height: ${touchTarget}px`,
    );
  });
});

describe("Banner", () => {
  it("should keep a trailing action at least the small control height", async () => {
    render(
      <Banner tone="review" action={{ label: "Copy to your foods", onClick: () => undefined }}>
        Energy is not given.
      </Banner>,
    );
    const { className } = screen.getByRole("button", { name: "Copy to your foods" });

    expect(await declarationsOf(className, "min-h-control-sm")).toBe(
      `min-height: ${controlHeight.sm}px`,
    );
  });
});

describe("GroupedList", () => {
  it("should keep the see more button at least a touch target high", async () => {
    render(
      <GroupedList title="Common foods" seeMore={{ hiddenCount: 2, onClick: () => undefined }}>
        <li>Apples</li>
      </GroupedList>,
    );
    const { className } = screen.getByRole("button", { name: /See 2 more/ });

    expect(await declarationsOf(className, "min-h-touch-target")).toBe(
      `min-height: ${touchTarget}px`,
    );
  });
});

describe("the links and navigation outside the kit", () => {
  it("should keep a navigation link at least a touch target high", async () => {
    render(<DashboardNav />);
    const { className } = screen.getByRole("link", { name: "Diary" });

    expect(await declarationsOf(className, "min-h-touch-target")).toBe(
      `min-height: ${touchTarget}px`,
    );
  });

  it("should keep the link to create a food from a barcode at least a touch target high", async () => {
    render(
      <BarcodeResult
        result={{ status: "not_found", code: "5000159484695" }}
        isLoading={false}
        error={null}
      />,
    );
    const { className } = screen.getByRole("link", { name: BARCODE_NOT_FOUND.action });

    expect(await declarationsOf(className, "min-h-touch-target")).toBe(
      `min-height: ${touchTarget}px`,
    );
  });

  it("should keep Cancel on a food form at least a touch target high", async () => {
    render(
      <FormActions
        submitLabel="Create food"
        cancelHref="/foods"
        isSaving={false}
        isSaveDisabled={false}
      />,
    );
    const { className } = screen.getByRole("link", { name: FOOD_FORM.cancel });

    expect(await declarationsOf(className, "min-h-touch-target")).toBe(
      `min-height: ${touchTarget}px`,
    );
  });

  it("should keep the way back from a food at least the small control height", async () => {
    render(<BackToFoodsLink />);
    const { className } = screen.getByRole("link", { name: FOOD_DETAIL.back });

    expect(await declarationsOf(className, "min-h-control-sm")).toBe(
      `min-height: ${controlHeight.sm}px`,
    );
  });

  it.each([
    ["min-h-touch-target", "min-h-[44px]"],
    ["min-h-control-sm", "min-h-[36px]"],
  ])(
    "should compile %s to the same height as the literal %s it replaced",
    async (named, literal) => {
      const minHeightOf = async (className: string) =>
        /min-height:\s*([^;}\s]+)/.exec(await compileUtilities(className))?.[1];

      expect(await minHeightOf(named)).toBeDefined();
      expect(await minHeightOf(named)).toBe(await minHeightOf(literal));
    },
  );
});
