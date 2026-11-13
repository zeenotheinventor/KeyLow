/**
 * What the composer holds when the sheet opens with words to prefill (the meal plan's Regenerate day and Plan my
 * week). Text the person typed is never overwritten: a composer that holds anything keeps it, and the prefill
 * only fills an empty one.
 */
export const composerTextForPrefill = (current: string, prefill: string): string =>
  current.trim() === "" ? prefill : current;

/**
 * What the composer holds once the sheet closes. A prefill the person left untouched is cleared, so it does not
 * wait in the composer for the next time the sheet opens from somewhere else. Anything they changed stays.
 */
export const composerTextOnClose = (current: string, prefill: string | undefined): string =>
  prefill !== undefined && current === prefill ? "" : current;
