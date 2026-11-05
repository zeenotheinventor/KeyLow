import type { SuggestionOfferState } from "./types";
import type { SuggestionDetailCopy, SuggestionDetailRow } from "@keylow/core/copy";

// The words of the `suggestion · card` and `suggestion · detail` boards, for Thursday's Legs seen on
// Wednesday at 12:00. They are core's and are tested there: these are the offer as the card is given it.

const plannedRows: readonly SuggestionDetailRow[] = [
  { name: "Barbell squat", target: "3 × 5 to 8 · RIR 2" },
  { name: "Romanian deadlift", target: "3 × 8 to 10 · RIR 2" },
  { name: "Leg press", target: "3 × 10 to 12 · RIR 1" },
  { name: "Seated leg curl", target: "3 × 10 to 12 · RIR 1" },
  { name: "Standing calf raise", target: "4 × 10 to 15 · RIR 1" },
].map((row) => ({ ...row, why: "From your plan", added: false }));

const inclinePress: SuggestionDetailRow = {
  name: "Incline dumbbell press",
  target: "3 × 8 to 10 · RIR 2",
  why: "Added. Upper chest is a V-taper priority, at 4.8 of 12 sets in the last 7 days, and ready now at heat 13 %. Lateral raises would not fit your 60 minutes.",
  added: true,
};

export const thursdayDetail: SuggestionDetailCopy = {
  title: "Suggested for Thursday",
  backLabel: "Back to Train",
  dayLine: "Thursday 15 October · your planned Legs",
  headline: "Legs, plus incline dumbbell press",
  loadLine: "6 exercises · 19 sets · about 60 min",
  listName: "Exercises for Thursday",
  rows: [...plannedRows, inclinePress],
  footnote:
    "Ki-Lo keeps your plan and adds what your week is short of. Muscles still hot are left out.",
  primaryAction: "Add to Thursday",
  primaryActionName: "Add to Thursday",
  dismissAction: "Not now",
  dismissActionName: "Not now for Thursday's suggestion",
};

/** A session of fourteen exercises, which no phone shows at once, to check the list scrolls in the sheet. */
export const longThursdayDetail: SuggestionDetailCopy = {
  ...thursdayDetail,
  loadLine: "14 exercises · 42 sets · about 90 min",
  rows: Array.from({ length: 14 }, (_, index) => ({
    name: `Exercise ${String(index + 1)}`,
    target: "3 × 10 to 12 · RIR 1",
    why: "From your plan",
    added: false,
  })),
};

export const thursdayOffer: SuggestionOfferState = {
  status: "offer",
  day: "2026-10-15",
  isForToday: false,
  isAccepting: false,
  accept: () => undefined,
  detail: thursdayDetail,
  copy: {
    cardName: "Suggestion for Thursday",
    label: "Suggested for Thursday",
    headline: "Legs, plus incline dumbbell press",
    linkName: "Suggested for Thursday: Legs, plus incline dumbbell press. See why",
    sentence: "Add 3 sets of incline dumbbell press to the end of Thursday's Legs.",
    reasonsName: "Why Ki-Lo suggests this for Thursday",
    reasons: [
      {
        kind: "volume",
        text: "Upper chest: 4.8 sets in the last 7 days, target 12, a V-taper priority",
      },
      { kind: "heat", text: "Upper chest is ready now: heat 13 %" },
      { kind: "length", text: "Thursday goes from 16 to 19 sets, about 60 minutes" },
    ],
    primaryAction: "Add to Thursday",
    primaryActionName: "Add to Thursday",
    dismissAction: "Not now",
    dismissActionName: "Not now for Thursday's suggestion",
  },
};
