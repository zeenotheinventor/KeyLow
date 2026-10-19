import type { EditSetSheetProps } from "../types";

export type EditSetFormProps = Pick<
  EditSetSheetProps,
  "entry" | "unit" | "onSave" | "onDelete" | "onClose"
>;
