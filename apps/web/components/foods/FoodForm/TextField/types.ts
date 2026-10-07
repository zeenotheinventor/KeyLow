import type { ComponentProps } from "react";

export type TextFieldProps = Omit<ComponentProps<"input">, "id" | "aria-describedby"> & {
  id: string;
  label: string;
  /** Always-visible helper text, read out after the label. */
  hint?: string | undefined;
  error?: string | undefined;
};
