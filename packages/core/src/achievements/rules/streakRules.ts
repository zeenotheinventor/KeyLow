import type { Measure } from "./types";

// Earned for good once reached, so the longest run is read, never the current one.
export const dailyStreak: Measure = ({ streaks }) => streaks.daily.longest;

export const trainingStreak: Measure = ({ streaks }) => streaks.training.longest;

export const weighInStreak: Measure = ({ streaks }) => streaks.weighIn.longest;

export const backOnTrack: Measure = ({ streaks }) => (streaks.backOnTrack ? 1 : 0);

export const freezesUsed: Measure = ({ streaks }) => streaks.freezesUsed;

export const freezesHeld: Measure = ({ streaks }) => streaks.freezesHeld;

export const weekendRun: Measure = ({ streaks }) => streaks.weekendRun;
