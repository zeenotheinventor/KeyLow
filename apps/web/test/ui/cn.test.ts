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
});
