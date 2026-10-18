/** A count with its noun agreeing with it: "1 session", "3 sessions", "0 sessions". Only exactly one is singular. */
export const describeCount = (count: number, singular: string, plural: string): string =>
  `${count} ${count === 1 ? singular : plural}`;
