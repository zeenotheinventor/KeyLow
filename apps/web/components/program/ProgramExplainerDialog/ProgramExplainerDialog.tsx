import { PROGRAM_EXPLAINER, describeExplainerSections } from "@keylow/core/copy";

import type { ProgramExplainerDialogProps } from "./types";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

/**
 * The dialog that explains the programme, as the `program-explainer` boards draw it: the seven sections, the
 * not-medical-advice line and Done in the footer. A short window scrolls the dialog's contents and keeps its
 * header and Done in view. It reads no network, so it opens offline. Render it only while it is open.
 */
export function ProgramExplainerDialog({
  checkInDate,
  onClose,
  returnFocusTo,
}: ProgramExplainerDialogProps) {
  return (
    <Dialog
      open
      title={PROGRAM_EXPLAINER.title}
      onClose={onClose}
      {...(returnFocusTo === undefined ? {} : { returnFocusTo })}
      footer={<Button onClick={onClose}>{PROGRAM_EXPLAINER.doneLabel}</Button>}
    >
      <div className="flex flex-col gap-4">
        {describeExplainerSections(checkInDate).map((section) => (
          <section key={section.title} className="flex flex-col gap-1">
            <h3 className="text-body-strong">{section.title}</h3>
            {/* The board sets the paragraphs at 14 over 21 in the regular weight, which no type class has. */}
            <p className="text-[14px] font-normal leading-[21px] text-text-secondary">
              {section.text}
            </p>
          </section>
        ))}
        <p className="text-caption text-text-muted">{PROGRAM_EXPLAINER.notMedicalAdvice}</p>
      </div>
    </Dialog>
  );
}
