import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("should keep a type style next to a text colour", () => {
    expect(cn("text-body-strong", "text-accent-foreground")).toBe(
      "text-body-strong text-accent-foreground",
    );
  });

  it.each(["display-numeral", "h1", "h2", "body", "body-strong", "caption", "numeral-small"])(
    "should know text-%s is a type style and not a colour",
    (style) => {
      expect(cn(`text-${style}`, "text-text-secondary")).toBe(`text-${style} text-text-secondary`);
    },
  );

  it("should let a later type style replace an earlier one", () => {
    expect(cn("text-body", "text-caption")).toBe("text-caption");
  });

  it.each(["small", "medium", "large", "pill"])(
    "should let a later rounded-%s replace an earlier radius",
    (radius) => {
      expect(cn("rounded-small", `rounded-${radius}`)).toBe(`rounded-${radius}`);
    },
  );

  it("should keep a radius next to a border colour", () => {
    expect(cn("rounded-large", "border-border")).toBe("rounded-large border-border");
  });

  describe("control sizes", () => {
    it.each(["h", "w", "min-h", "min-w"])(
      "should let a later %s step replace an earlier control size",
      (prefix) => {
        expect(cn(`${prefix}-control-md`, `${prefix}-11`)).toBe(`${prefix}-11`);
        expect(cn(`${prefix}-11`, `${prefix}-control-md`)).toBe(`${prefix}-control-md`);
        expect(cn(`${prefix}-control-sm`, `${prefix}-touch-target`)).toBe(`${prefix}-touch-target`);
      },
    );

    it("should keep a height next to a width and a minimum height", () => {
      expect(cn("h-control-md", "w-control-md", "min-h-touch-target")).toBe(
        "h-control-md w-control-md min-h-touch-target",
      );
    });
  });

  describe("press scale", () => {
    it("should let a later scale replace the press scale", () => {
      expect(cn("active:scale-press", "active:scale-95")).toBe("active:scale-95");
      expect(cn("active:scale-95", "active:scale-press")).toBe("active:scale-press");
    });

    it("should keep the press scale next to its reduced motion override", () => {
      expect(cn("active:scale-press", "motion-reduce:active:scale-100")).toBe(
        "active:scale-press motion-reduce:active:scale-100",
      );
    });
  });
});
