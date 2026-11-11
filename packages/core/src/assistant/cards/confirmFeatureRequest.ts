import { ASSISTANT_FEATURE_REQUEST_COPY } from "../../copy/assistantFeatureRequest";

/** The two buttons under the offer to send a feature request. */
export const confirmFeatureRequestButtons = () => ({
  confirmLabel: ASSISTANT_FEATURE_REQUEST_COPY.confirmLabel,
  cancelLabel: ASSISTANT_FEATURE_REQUEST_COPY.cancelLabel,
});

/** "Send this to the Ki-Lo team as a feature request?" */
export const confirmFeatureRequestQuestion = (): string => ASSISTANT_FEATURE_REQUEST_COPY.question;

/** The line the turn loop adds after the question: what goes with the request. */
export const confirmFeatureRequestNote = (): string => ASSISTANT_FEATURE_REQUEST_COPY.note;
