import { SUGGESTION_DETAIL } from "@keylow/core/copy";
import { useId, useState } from "react";

import { SuggestionExerciseRow } from "../SuggestionExerciseRow";

import type { SuggestionDetailDialogProps } from "./types";

import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";

// Below 700 px the dialog fills the screen and the buttons share the footer as the board draws it, Not now
// one part and the primary two. From 700 px the footer is the kit's, right aligned, with buttons of their size.
const dismissClassName = "flex-1 min-[700px]:flex-none";
const primaryClassName = "flex-[2] min-[700px]:flex-none";

/**
 * The whole suggested session with its reasons, as the `suggestion · detail` board draws it, reused as a
 * dialog in the web shell: the day, the headline and the length, a row for each exercise with its target and
 * where it came from, the footnote, and Not now and Add under them. Every word is core's, given in the
 * offer's `detail`. For today's suggestion the primary button is Start, which is the card's too. Add and Start
 * are off without a connection, so a press cannot leave a write paused, and a line above the buttons says why
 * (the page's own offline banner is behind the modal). Not now only writes this browser's store, so it stays
 * on. The offer is kept while the dialog stays open without it, so the contents do not vanish when the
 * connection goes. Start shows busy while a session start is under way.
 */
export function SuggestionDetailDialog({
  open,
  offer,
  isOnline,
  isStarting,
  onClose,
  onPrimary,
  onDismiss,
}: SuggestionDetailDialogProps) {
  const offlineLineId = useId();
  const [lastOffer, setLastOffer] = useState(offer);
  if (offer !== undefined && offer !== lastOffer) {
    setLastOffer(offer);
  }
  const shown = offer ?? lastOffer;
  const detail = shown?.detail;
  if (shown === undefined || detail === undefined) {
    return null;
  }
  const hasPrimary = shown.accept !== undefined || shown.start !== undefined;

  return (
    <Dialog
      open={open}
      title={detail.title}
      closeLabel={detail.backLabel}
      onClose={onClose}
      footer={
        <div className="flex w-full flex-col gap-3">
          {isOnline ? null : (
            <div id={offlineLineId}>
              <Banner tone="info">{SUGGESTION_DETAIL.offline}</Banner>
            </div>
          )}
          <div className="flex items-center justify-end gap-3">
            <Button
              aria-label={detail.dismissActionName}
              className={dismissClassName}
              variant="secondary"
              onClick={onDismiss}
            >
              {detail.dismissAction}
            </Button>
            {hasPrimary ? (
              <Button
                aria-describedby={isOnline ? undefined : offlineLineId}
                aria-label={detail.primaryActionName}
                className={primaryClassName}
                disabled={!isOnline}
                loading={shown.isAccepting || (shown.isForToday && isStarting)}
                onClick={onPrimary}
              >
                {detail.primaryAction}
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <Card className="flex flex-col gap-1">
          <span className="text-caption text-text-muted">{detail.dayLine}</span>
          <h3 className="break-words text-h2">{detail.headline}</h3>
          <span className="text-caption tabular-nums text-text-secondary">{detail.loadLine}</span>
        </Card>
        <Card padding="none">
          <ul aria-label={detail.listName}>
            {/* The rows are a static list, and a day can hold one exercise twice, so a name is no key. */}
            {detail.rows.map((row, position) => (
              <SuggestionExerciseRow key={position} hasDivider={position > 0} row={row} />
            ))}
          </ul>
        </Card>
        <p className="text-caption text-text-muted">{detail.footnote}</p>
      </div>
    </Dialog>
  );
}
