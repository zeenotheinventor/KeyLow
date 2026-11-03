import * as copy from "../../../src/copy";
import { collectStrings } from "../collectStrings";

// Every function `src/copy/assistantSettings.ts` exports, called with representative arguments. The voice test
// fails when a function has no row, so no sentence escapes the sweep. The row's words are read before the
// setting is known too, which leaves the title alone.
export const samples: Record<string, () => string[]> = {
  describeAssistantMoreRow: () =>
    [false, true, undefined].flatMap((isOn) => collectStrings(copy.describeAssistantMoreRow(isOn))),
  describeAssistantConsentCaption: () => [
    copy.describeAssistantConsentCaption(false),
    copy.describeAssistantConsentCaption(true),
  ],
};
