import type { FormErrors, PortionFormValues } from "../types";
import type { NutrientBasis } from "@keylow/core/schemas";

export type PortionsCardProps = {
  basis: NutrientBasis;
  portions: PortionFormValues[];
  errors: FormErrors["portions"];
  /** Makes each row's field ids unique within the page. */
  idPrefix: string;
  onAdd: () => void;
  onChange: (key: string, changes: Partial<PortionFormValues>) => void;
  onDefaultChange: (key: string, isDefault: boolean) => void;
  onRemove: (key: string) => void;
};
