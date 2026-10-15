import type { AmountFood, AmountPortion, AmountPreview, UnitOption } from "@keylow/core/diary";
import type { Ref, ReactNode } from "react";

export type PortionFieldsProps = {
  /** The food's name, written on the first line of the hero. */
  name: string;
  /** The values the amount is worked out from: the food's own when adding, the entry's snapshot when editing. */
  food: AmountFood;
  /** What the amount means in the hero and the amount field's suffix. */
  portions: readonly AmountPortion[];
  /** The chips: the portions, then g, then ml where it applies. */
  unitOptions: readonly UnitOption[];
  /** What the text in the amount field and the chosen unit come to, from core's `previewAmount`. */
  preview: AmountPreview;
  quantityText: string;
  unitValue: string;
  onQuantityChange: (text: string) => void;
  onUnitChange: (value: string) => void;
  /** Reaches the amount field, so a dialog can put the cursor in it. */
  amountRef?: Ref<HTMLInputElement> | undefined;
  /** The Time field's value, `HH:mm`. */
  time: string;
  /** The time is still the moment the dialog opened, so the Time field says Now. */
  isNow: boolean;
  onTimeChange: (time: string) => void;
  /** Banners that go above the hero, such as the review notice or a failed save. */
  notice?: ReactNode;
};
