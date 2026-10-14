import { iconStroke } from "@keylow/tokens";
import { cva } from "class-variance-authority";
import { ScanBarcode, Search } from "lucide-react";

import type { BarcodeButton, SearchFieldProps, SearchLauncherProps, SearchSize } from "./types";
import type * as React from "react";

import { cn } from "@/lib/utils";

// The web analogue of the docked search bar. It is a design system addition drawn only on the
// approved boards, so these values are the boards'. The compact size is the top bar's (36 high,
// 14 on 20 text, which the type scale has no style for) and the default is the foods page's (44).
// Focus anywhere inside gives the frame the accent border and the ring.
const searchFrame = cva(
  "flex items-center rounded-medium border border-border bg-surface-raised text-text-muted transition-[border-color,box-shadow] duration-quick has-[:focus-visible]:border-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-focus-ring-offset has-[:disabled]:opacity-50",
  {
    variants: {
      size: {
        md: "h-[44px] gap-2 pl-4 pr-1",
        sm: "h-[36px] gap-2 pl-3 pr-1",
      },
    },
    defaultVariants: { size: "md" },
  },
);

const fieldText = cva("", {
  variants: {
    size: { md: "text-body", sm: "text-[14px] leading-5" },
  },
  defaultVariants: { size: "md" },
});

const barcodeButtonSize = cva(
  "flex shrink-0 items-center justify-center rounded-small text-text-primary outline-none transition-colors duration-quick hover:bg-hover-overlay active:bg-press-overlay aria-expanded:bg-surface-sheet focus-visible:bg-hover-overlay focus-visible:ring-2 focus-visible:ring-focus-ring",
  {
    variants: { size: { md: "size-9", sm: "size-7" } },
    defaultVariants: { size: "md" },
  },
);

const iconSize = { md: "size-5", sm: "size-4" } as const;

function BarcodeIconButton({ button, size }: { button: BarcodeButton; size: SearchSize }) {
  return (
    <button
      type="button"
      aria-label={button.label}
      aria-expanded={button.expanded}
      onClick={button.onClick}
      className={barcodeButtonSize({ size })}
    >
      <ScanBarcode aria-hidden className={iconSize[size]} strokeWidth={iconStroke} />
    </button>
  );
}

// The return type names React on purpose: the repo has two copies of @types/react, and a file that
// imports react gets the JSX types that match the input props from `./types`.
export function SearchField({
  label,
  size = "md",
  barcodeButton,
  className,
  ...inputProps
}: SearchFieldProps): React.JSX.Element {
  return (
    <div role="search" className={cn(searchFrame({ size }), className)}>
      <Search aria-hidden className={cn("shrink-0", iconSize[size])} strokeWidth={iconStroke} />
      <input
        type="search"
        aria-label={label}
        className={cn(
          "h-full min-w-0 flex-1 bg-transparent p-0 text-text-primary outline-none placeholder:text-text-muted [&::-webkit-search-cancel-button]:appearance-none",
          fieldText({ size }),
        )}
        {...inputProps}
      />
      {barcodeButton !== undefined && <BarcodeIconButton button={barcodeButton} size={size} />}
    </div>
  );
}

// The search field used as a button: it looks like the field but holds no input, because the
// search itself happens on the foods page.
export function SearchLauncher({
  label,
  onSearch,
  size = "md",
  barcodeButton,
  className,
}: SearchLauncherProps) {
  return (
    <div className={cn(searchFrame({ size }), className)}>
      <button
        type="button"
        onClick={onSearch}
        className={cn(
          "flex h-full min-w-0 flex-1 items-center gap-2 text-left text-text-muted outline-none",
          fieldText({ size }),
        )}
      >
        <Search aria-hidden className={cn("shrink-0", iconSize[size])} strokeWidth={iconStroke} />
        <span className="truncate">{label}</span>
      </button>
      {barcodeButton !== undefined && <BarcodeIconButton button={barcodeButton} size={size} />}
    </div>
  );
}
