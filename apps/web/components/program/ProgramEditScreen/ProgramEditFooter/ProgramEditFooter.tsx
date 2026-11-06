import { PROGRAM_EDIT, PROGRAM_EDIT_FAILED_BANNER, describeEditFootnote } from "@keylow/core/copy";

import type { ProgramEditFooterProps } from "./types";

import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";

/**
 * The sticky form footer of Edit programme, which `program-edit` draws as new feature code and not kit: it sticks
 * to the bottom of the window, spans the page on `surface-sheet` and holds the footnote and Save changes, side by
 * side from the large breakpoint and stacked with a full width large button under it. The one notice slot sits
 * over the footnote and the footer grows to hold it. The negative margins take it out to the window's edges and
 * down over the page's bottom padding, so it ends flush with the page and the last card has the page's own room
 * above it.
 */
export function ProgramEditFooter({
  notice,
  expenditureKcal,
  isSaving,
  isSaveOff,
  onSave,
  ref,
  saveButtonRef,
}: ProgramEditFooterProps) {
  return (
    <footer
      ref={ref}
      className="sticky bottom-0 z-[5] -mx-4 -mb-6 mt-6 border-t border-border bg-surface-sheet px-4 pb-3 pt-4 lg:-mx-8 lg:-mb-10 lg:mt-10 lg:px-8 lg:py-3"
    >
      <div className="mx-auto flex max-w-[1180px] flex-col gap-3">
        {notice === "offline" && <Banner tone="info">{PROGRAM_EDIT.saveOffline}</Banner>}
        {notice === "save-failed" && <Banner tone="error">{PROGRAM_EDIT_FAILED_BANNER}</Banner>}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <p className="min-w-0 text-caption tabular-nums text-text-secondary">
            {describeEditFootnote(expenditureKcal)}
          </p>
          <Button
            ref={saveButtonRef}
            size="lg"
            className="w-full lg:h-control-md lg:w-auto lg:px-4"
            disabled={isSaveOff}
            loading={isSaving}
            loadingLabel="Saving"
            onClick={onSave}
          >
            {PROGRAM_EDIT.saveLabel}
          </Button>
        </div>
      </div>
    </footer>
  );
}
