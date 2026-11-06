/**
 * The day the programme checks in on, `YYYY-MM-DD`: the next check-in's date, or the start's before one is
 * set. Both fall on the weekday the person set up on, so the weekday of either names the check-in day.
 */
export const programCheckInDate = ({
  nextCheckinDate,
  startedOn,
}: Readonly<{ nextCheckinDate: string | null; startedOn: string }>): string =>
  nextCheckinDate ?? startedOn;
