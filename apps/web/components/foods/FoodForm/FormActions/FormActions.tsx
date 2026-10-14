import { FOOD_FORM } from "@keylow/core/copy";
import Link from "next/link";

import type { FormActionsProps } from "./types";

import { Button } from "@/components/ui/button";

/** The save button, and a Cancel link beside it. */
export function FormActions({
  submitLabel,
  cancelHref,
  isSaving,
  isSaveDisabled,
}: FormActionsProps) {
  return (
    <div className="flex items-center gap-3">
      <Button
        type="submit"
        size="lg"
        className="min-w-[200px] px-6"
        loading={isSaving}
        loadingLabel={FOOD_FORM.saving}
        disabled={isSaveDisabled}
      >
        {submitLabel}
      </Button>
      <Link
        href={cancelHref}
        className="flex min-h-[44px] items-center rounded-small px-2 text-body-strong text-text-secondary underline outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        {FOOD_FORM.cancel}
      </Link>
    </div>
  );
}
