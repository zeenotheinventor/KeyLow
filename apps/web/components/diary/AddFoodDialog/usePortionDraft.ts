import { useLogFood } from "@keylow/api-client";
import { useState } from "react";

import { useAmountDraft } from "./useAmountDraft";

import type { AmountDraft, ReadyAmountDraft } from "./useAmountDraft";

export type PortionDraft =
  | Exclude<AmountDraft, ReadyAmountDraft>
  | (ReadyAmountDraft & {
      isSaving: boolean;
      hasSaveError: boolean;
      /** Logs the amount at the instant given. Resolves true when it was saved. */
      add: (when: { loggedAt: Date; localDate: string }) => Promise<boolean>;
    });

/**
 * The portion step's state for the food chosen from the search: the amount step's (`useAmountDraft`) and the
 * log. The failure of a save is not kept: it can quote the amount, which is health data, so the banner says
 * what to do and nothing more.
 */
export function usePortionDraft(foodId: string | undefined): PortionDraft {
  const amount = useAmountDraft(foodId);
  const logFood = useLogFood();
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaveError, setHasSaveError] = useState(false);

  if (amount.status !== "ready") {
    return amount;
  }

  const { food, preview } = amount;

  return {
    ...amount,
    isSaving,
    hasSaveError,
    add: async ({ loggedAt, localDate }) => {
      const chosen = preview.amount;
      if (chosen === null) {
        return false;
      }
      setIsSaving(true);
      setHasSaveError(false);
      try {
        await logFood.mutateAsync({
          food,
          quantity: chosen.quantity,
          unit: chosen.unit,
          ...(chosen.unit === "portion" ? { portion: chosen.portion } : {}),
          loggedAt: loggedAt.toISOString(),
          localDate,
        });
        return true;
      } catch {
        setHasSaveError(true);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
  };
}
