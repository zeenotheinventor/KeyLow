import type { Measure } from "./types";

export const weighIns: Measure = ({ stats }) => stats.weighIns.count;

export const weighInDays: Measure = ({ stats }) => stats.weighIns.distinctLocalDates;

export const earlyWeighIns: Measure = ({ stats }) => stats.weighIns.beforeNineAmCount;

export const bodyCompositionReadings: Measure = ({ stats }) => stats.bodyCompositionReadingCount;
