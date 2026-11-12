import { FEATURE_REQUEST_TEXT_MAX } from "../featureRequests";
import { formatScaledCount } from "../format/scaledCount";
import { characterCount } from "../recipes/characterCount";

/**
 * The words of the Request a feature screen (KEY-978), pushed from More. No board draws it, so it follows
 * Export my data. The request holds whatever the user typed, so none of it is ever echoed back in a message.
 */
export const FEATURE_REQUEST_SCREEN = {
  title: "Request a feature",
  back: "Back to More",
  explainer: "Your request goes to the Ki-Lo team, and every one is read.",
  fieldLabel: "Your feature request",
  placeholder: "What should Ki-Lo do next?",
  send: "Send",
  tooLong: "That is over 1,000 characters. Shorten it to send.",
  sentToast: "Thanks, your request has been sent",
  failed: {
    title: "Your request was not sent",
    body: "Check your connection and try again. What you typed is still here.",
  },
  dailyLimit: {
    title: "Daily limit reached",
    body: "You have sent the most requests Ki-Lo takes in a day. Try again tomorrow. What you typed is still here.",
  },
};

/** The counter under the field: "14 / 1,000", counted on the trimmed text as the request is saved. */
export const describeFeatureRequestLength = (text: string): string =>
  `${formatScaledCount(characterCount(text.trim()))} / ${formatScaledCount(FEATURE_REQUEST_TEXT_MAX)}`;
