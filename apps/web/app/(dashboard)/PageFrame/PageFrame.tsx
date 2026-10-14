import type { PageFrameProps, PageFrameVariant } from "./types";

// Each family's boards draw the same top and bottom padding at a phone and at a desktop width.
// The layout's main keeps the sides, which are the same for every family. The class names are
// written out in full so Tailwind can see them.
const VERTICAL_PADDING_CLASSES: Record<PageFrameVariant, string> = {
  shell: "py-6 lg:py-10",
  foodSearch: "py-5 lg:py-8",
  foodRecord: "py-4 lg:py-6",
};

export function PageFrame({ variant, children }: PageFrameProps) {
  return <div className={VERTICAL_PADDING_CLASSES[variant]}>{children}</div>;
}
