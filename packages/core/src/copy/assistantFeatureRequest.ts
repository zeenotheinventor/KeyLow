/*
 * The words of the assistant's feature request: the offer, its two buttons, the line about what goes with
 * the request, and the card that says it was sent. NOT ON THE CANVAS: the designers have not drawn this
 * confirmation or card, so the words wait for Zee's approval. The More screen has its own file,
 * `featureRequestScreen.ts`.
 */
export const ASSISTANT_FEATURE_REQUEST_COPY = {
  question: "Send this to the Ki-Lo team as a feature request?",
  confirmLabel: "Send request",
  cancelLabel: "No thanks",
  note: "A short part of this chat goes with it, and stays even if the chat is deleted.",
  cardTitle: "Feature request sent",
} as const;
