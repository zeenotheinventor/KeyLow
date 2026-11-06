/** What one kind's read is: still loading, failed with nothing to show, read with nothing, or read with readings. */
export type BodyCompositionKindStatus = "loading" | "empty" | "error" | "readings";

/**
 * What a Body composition screen draws, the first match of the rules that chose it. `paused` is a read that
 * cannot finish because the connection is down: the screen says so without a Try again, since the read goes
 * ahead by itself when the connection returns.
 */
export type BodyCompositionStage = "loading" | "paused" | "drawing" | "error" | "no-readings";

const isLoading = (statuses: readonly BodyCompositionKindStatus[]): boolean =>
  statuses.includes("loading");
const hasError = (statuses: readonly BodyCompositionKindStatus[]): boolean =>
  statuses.includes("error");

/**
 * What the composition view draws, from the statuses of the kinds it reads. Online, a kind still loading
 * wins, so the lines do not change from lean mass to body fat when the other kind arrives. Then a split that
 * can be worked out from either kind is drawn, even when the other kind failed. Then a failure, and last no
 * readings. Offline a read pauses and never finishes, so a loading kind is not waited for: a split is drawn,
 * and with none the stage is `paused`.
 */
export function bodyCompositionViewStage({
  statuses,
  hasSplit,
  isOnline,
}: {
  statuses: readonly BodyCompositionKindStatus[];
  hasSplit: boolean;
  isOnline: boolean;
}): BodyCompositionStage {
  if (hasSplit && (!isLoading(statuses) || !isOnline)) {
    return "drawing";
  }
  if (isLoading(statuses)) {
    return isOnline ? "loading" : "paused";
  }

  return hasError(statuses) ? "error" : "no-readings";
}

/**
 * What the Body composition section draws, from the statuses of the kinds it reads. It differs from the view
 * on one rule: a failure wins over the cards, because a card is a kind's own and a kind that failed has none,
 * where the view's one figure can be worked out from the other kind. So the order is loading (`paused`
 * offline), then a failure, then the cards, or no readings when there is none.
 */
export function bodyCompositionSectionStage({
  statuses,
  hasCards,
  isOnline,
}: {
  statuses: readonly BodyCompositionKindStatus[];
  hasCards: boolean;
  isOnline: boolean;
}): BodyCompositionStage {
  if (isLoading(statuses)) {
    return isOnline ? "loading" : "paused";
  }
  if (hasError(statuses)) {
    return "error";
  }

  return hasCards ? "drawing" : "no-readings";
}
