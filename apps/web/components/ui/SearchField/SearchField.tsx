import { iconStroke } from "@keylow/tokens";
import { cva } from "class-variance-authority";
import { CircleX, ScanBarcode, Search } from "lucide-react";

import type {
  BarcodeButton,
  ClearButton,
  SearchFieldProps,
  SearchLauncherProps,
  SearchLauncherSize,
} from "./types";

import { cn } from "@/lib/utils";

// The web analogue of the docked search bar. It is a design system addition drawn only on the
// approved boards, so these values are the boards'. The compact size is the top bar's (36 high,
// 14 on 20 text, which the type scale has no style for) and the default is the foods page's (44).
// Focus anywhere inside gives the frame the accent border. The field adds the ring in light only,
// where the accent border is under 3:1, as `Input` does. The launcher draws the ring in both
// themes, as the shell board does.
const searchFrame = cva(
  "flex items-center rounded-medium border border-border bg-surface-raised text-text-muted transition-[border-color,box-shadow] duration-quick has-[:focus-visible]:border-accent has-[:focus-visible]:ring-focus-ring has-[:focus-visible]:ring-offset-focus-ring-offset has-[:disabled]:opacity-50",
  {
    variants: {
      size: {
        md: "h-control-md gap-2 pl-4 pr-1",
        sm: "h-control-sm gap-2 pl-3 pr-1",
        adaptive: "h-control-md gap-2 pl-4 pr-1 lg:h-control-sm lg:pl-3",
      },
      focusRing: {
        lightOnly:
          "light-theme:has-[:focus-visible]:ring-2 light-theme:has-[:focus-visible]:ring-offset-2",
        always: "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2",
      },
    },
    defaultVariants: { size: "md", focusRing: "lightOnly" },
  },
);

const fieldText = cva("", {
  variants: {
    size: {
      md: "text-body",
      sm: "text-[14px] leading-5",
      adaptive: "text-body lg:text-[14px] lg:leading-5",
    },
  },
  defaultVariants: { size: "md" },
});

// Both icon buttons are under 44 px (the barcode button is 36 px, or 28 px in the dense size, and the clear
// button is 36 px), so each reaches a 44 px square with an invisible pseudo element. The gap between the
// controls is 8 px, so a reach of 4 px meets the next control without covering it. The dense barcode
// button is 28 px, so it reaches 8 px up and down, 4 px to the left (where the clear button reaches 4 px to
// meet it) and 12 px to the right, past the field's 5 px of padding and border, where nothing sits.
const barcodeButtonSize = cva(
  "relative flex shrink-0 items-center justify-center rounded-small text-text-primary outline-none transition-colors duration-quick hover:bg-hover-overlay active:bg-press-overlay aria-expanded:bg-surface-sheet after:absolute focus-visible:bg-hover-overlay focus-visible:ring-2 focus-visible:ring-focus-ring",
  {
    variants: {
      size: {
        md: "size-9 after:-inset-1",
        sm: "size-7 after:-inset-y-2 after:-left-1 after:-right-3",
        adaptive:
          "size-9 after:-inset-1 lg:size-7 lg:after:-inset-y-2 lg:after:-left-1 lg:after:-right-3",
      },
    },
    defaultVariants: { size: "md" },
  },
);

const iconSize = { md: "size-5", sm: "size-4", adaptive: "size-5 lg:size-4" } as const;

function BarcodeIconButton({
  button,
  size,
  disabled = false,
}: {
  button: BarcodeButton;
  size: SearchLauncherSize;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={button.label}
      aria-expanded={button.expanded}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : button.onClick}
      // A disabled button opens nothing, so it shows no hover or press overlay.
      className={cn(
        barcodeButtonSize({ size }),
        disabled && "hover:bg-transparent active:bg-transparent",
      )}
    >
      <ScanBarcode aria-hidden className={iconSize[size]} strokeWidth={iconStroke} />
    </button>
  );
}

// The clear button is 36 px square, as the recipes boards draw it, and sits inside the field's right padding.
// Its pseudo element reaches 4 px each way to a 44 px square.
function ClearIconButton({
  button,
  disabled,
}: {
  button: ClearButton;
  disabled: boolean | undefined;
}) {
  return (
    <button
      type="button"
      aria-label={button.label}
      disabled={disabled}
      onClick={button.onClick}
      className="relative flex size-9 shrink-0 items-center justify-center rounded-small text-text-secondary outline-none transition-colors duration-quick after:absolute after:-inset-1 hover:bg-hover-overlay active:bg-press-overlay focus-visible:bg-hover-overlay focus-visible:ring-2 focus-visible:ring-focus-ring"
    >
      <CircleX aria-hidden className="size-5" strokeWidth={iconStroke} />
    </button>
  );
}

// A text input cannot carry a pseudo element, so the input is 44 px high and centred in the frame, which
// is 36 or 44 px high with a 1 px border. It draws nothing of its own, so the frame stays the drawn box and
// the extra height only makes the press land on the field. The launcher's button does the same.
export function SearchField({
  label,
  size = "md",
  barcodeButton,
  clear,
  className,
  ...inputProps
}: SearchFieldProps) {
  return (
    <div role="search" className={cn(searchFrame({ size }), className)}>
      <Search aria-hidden className={cn("shrink-0", iconSize[size])} strokeWidth={iconStroke} />
      <input
        type="search"
        aria-label={label}
        className={cn(
          "h-touch-target min-w-0 flex-1 bg-transparent p-0 text-text-primary outline-none placeholder:text-text-muted [&::-webkit-search-cancel-button]:appearance-none",
          fieldText({ size }),
        )}
        {...inputProps}
      />
      {clear !== undefined && typeof inputProps.value === "string" && inputProps.value !== "" && (
        <ClearIconButton button={clear} disabled={inputProps.disabled} />
      )}
      {barcodeButton !== undefined && <BarcodeIconButton button={barcodeButton} size={size} />}
    </div>
  );
}

// The search field used as a button: it looks like the field but holds no input, because the
// search itself happens on the foods page. Disabled it is dimmed to half and opens nothing, as a
// search cannot run offline. It stays focusable, so a screen reader finds it and hears it is disabled.
export function SearchLauncher({
  label,
  onSearch,
  size = "md",
  barcodeButton,
  disabled = false,
  className,
}: SearchLauncherProps) {
  return (
    <div
      className={cn(
        searchFrame({ size, focusRing: "always" }),
        disabled && "opacity-50",
        className,
      )}
    >
      <button
        type="button"
        aria-disabled={disabled || undefined}
        onClick={disabled ? undefined : onSearch}
        className={cn(
          "flex h-touch-target min-w-0 flex-1 items-center gap-2 text-left text-text-muted outline-none",
          fieldText({ size }),
        )}
      >
        <Search aria-hidden className={cn("shrink-0", iconSize[size])} strokeWidth={iconStroke} />
        <span className="truncate">{label}</span>
      </button>
      {barcodeButton !== undefined && (
        <BarcodeIconButton button={barcodeButton} size={size} disabled={disabled} />
      )}
    </div>
  );
}
