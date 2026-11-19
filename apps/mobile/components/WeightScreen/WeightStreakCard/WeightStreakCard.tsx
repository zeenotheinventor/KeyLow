import { useStreakView } from "../../../lib/streaks";
import { WeeklyStreakCard } from "../../WeeklyStreakCard";

/** The weigh-in streak on the Weight screen. It names no weight, only the habit, and is left out until the streak is read. */
export function WeightStreakCard() {
  const streak = useStreakView();

  return streak === undefined ? null : (
    <WeeklyStreakCard kind="weigh_in" streak={streak.weighIn.streak} />
  );
}
