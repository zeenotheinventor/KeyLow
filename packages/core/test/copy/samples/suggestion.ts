import * as copy from "../../../src/copy";
import {
  allHot,
  bandsOnly,
  detailForFreshToday,
  detailForThursday,
  forFreshToday,
  forThursday,
  forToday,
  goldenAdd,
  noRoomOnLegs,
  prioritiesCovered,
  strengthGoals,
  strengthSession,
  twoAdds,
  vTaperSession,
} from "../suggestionInputs";

import type { SuggestionCardCopy, SuggestionDetailCopy } from "../../../src/copy";

// Every function `src/copy/suggestion.ts` exports, called with representative arguments: a day that is
// tomorrow and one that is today, one and two additions, a fresh session, and each reason for nothing.
const cardSentences = ({ reasons, ...card }: SuggestionCardCopy): string[] => [
  ...Object.values(card),
  ...reasons.map((reason) => reason.text),
];

const detailSentences = ({ rows, ...detail }: SuggestionDetailCopy): string[] => [
  ...Object.values(detail),
  ...rows.flatMap((row) => [row.name, row.target, row.why]),
];

export const samples: Record<string, () => string[]> = {
  describeSuggestionCard: () => [
    ...cardSentences(copy.describeSuggestionCard(goldenAdd, forThursday)),
    ...cardSentences(copy.describeSuggestionCard(goldenAdd, forToday)),
    ...cardSentences(copy.describeSuggestionCard(twoAdds, forThursday)),
    ...cardSentences(copy.describeSuggestionCard(vTaperSession, forFreshToday)),
  ],
  describeSuggestionDetail: () => [
    ...detailSentences(copy.describeSuggestionDetail(goldenAdd, detailForThursday)),
    ...detailSentences(copy.describeSuggestionDetail(twoAdds, detailForThursday)),
    ...detailSentences(
      copy.describeSuggestionDetail(strengthSession, {
        ...detailForFreshToday,
        goals: strengthGoals,
      }),
    ),
  ],
  describeSuggestionAccepted: () => [
    ...Object.values(copy.describeSuggestionAccepted(goldenAdd, forThursday)),
    ...Object.values(copy.describeSuggestionAccepted(twoAdds, forToday)),
  ],
  describeNothingToSuggest: () =>
    [prioritiesCovered, noRoomOnLegs, allHot, bandsOnly].flatMap((nothing) =>
      [forThursday, forToday, forFreshToday].flatMap((context) =>
        Object.values(copy.describeNothingToSuggest(nothing, context)),
      ),
    ),
};
