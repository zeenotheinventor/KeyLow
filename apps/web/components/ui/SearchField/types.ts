import type { ComponentProps } from "react";

export type SearchSize = "sm" | "md";

/** The top bar's launcher is medium below the large breakpoint and small from it. */
export type SearchLauncherSize = SearchSize | "adaptive";

export type BarcodeButton = {
  /** What the button is called, such as "Look up a barcode". */
  label: string;
  /** Set it when the button opens a panel, so assistive technology knows whether it is open. */
  expanded?: boolean;
  onClick: () => void;
};

export type ClearButton = {
  /** What the button is called, such as "Clear search". */
  label: string;
  onClick: () => void;
};

export type SearchFieldProps = Omit<ComponentProps<"input">, "type" | "size" | "aria-label"> & {
  /** The search box's accessible name. */
  label: string;
  size?: SearchSize;
  barcodeButton?: BarcodeButton;
  /** Adds a button that empties the field. It shows once the field holds text, so give the field a `value`. */
  clear?: ClearButton;
};

export type SearchLauncherProps = {
  /** The text shown in the field and the name of the button that opens the search. */
  label: string;
  onSearch: () => void;
  size?: SearchLauncherSize;
  barcodeButton?: BarcodeButton;
  /** Dims the launcher and keeps it from opening anything, such as the search while offline. It stays focusable and says it is disabled. */
  disabled?: boolean;
  className?: string;
};
