/**
 * Whether the person's own message is the words of the confirm button. A confirmation is spent only on
 * that, so a model that misreads an answer, or text inside a tool result, cannot spend one. Adding a short
 * list of typed yes-words later is one line here, and this function only ever receives the person's own
 * text, never a tool result. Anything missing is no.
 */
export function isConfirmAnswer(words: string | null, confirmLabel: string | null): boolean {
  if (words === null || confirmLabel === null) {
    return false;
  }
  const answer = words.trim().toLowerCase();
  return answer !== "" && answer === confirmLabel.trim().toLowerCase();
}
