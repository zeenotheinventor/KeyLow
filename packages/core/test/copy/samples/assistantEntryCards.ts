import * as copy from "../../../src/copy";

// Every function `src/copy/assistantEntryCards.ts` exports, called with representative arguments. The voice test
// fails when a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  joinNames: () => [
    copy.joinNames(["egg"]),
    copy.joinNames(["egg", "toast"]),
    copy.joinNames(["egg", "toast", "tea"]),
  ],
  describeLoggedTitle: () => [
    copy.describeLoggedTitle(["2 eggs", "toast"], "08:10"),
    copy.describeLoggedTitle(["toast"], null),
  ],
  describeLoggedUndone: () => [
    copy.describeLoggedUndone(["2 eggs", "toast"], "08:10"),
    copy.describeLoggedUndone(["toast"], null),
  ],
  describeDeletedTitle: () => [copy.describeDeletedTitle(1), copy.describeDeletedTitle(3)],
  describeDeletedSub: () => [
    copy.describeDeletedSub(["apple", "pear"], "13:00"),
    copy.describeDeletedSub(["apple"], null),
  ],
  describeDeletedUndone: () => [
    copy.describeDeletedUndone(3, "13:00"),
    copy.describeDeletedUndone(1, null),
  ],
  describeConfirmDeleteQuestion: () => [
    copy.describeConfirmDeleteQuestion(3, "13:00", "today", ["apple", "pear", "tea"]),
    copy.describeConfirmDeleteQuestion(2, null, "yesterday", ["apple", "pear"]),
  ],
};
