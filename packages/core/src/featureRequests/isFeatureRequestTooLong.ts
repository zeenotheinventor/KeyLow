import { FEATURE_REQUEST_TEXT_MAX } from "./schemas";
import { characterCount } from "../recipes/characterCount";

/** Whether the request, trimmed as it is saved, is past the most the database holds. */
export const isFeatureRequestTooLong = (text: string): boolean =>
  characterCount(text.trim()) > FEATURE_REQUEST_TEXT_MAX;
