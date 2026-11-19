import { useStreakView } from "../../../lib/streaks";
import { WeeklyStreakCard } from "../../WeeklyStreakCard";

/** The training streak at the top of the Train tab. It is left out until the streak is read, and when it cannot be. */
export function TrainStreakCard() {
  const streak = useStreakView();

  return streak === undefined ? null : (
    <WeeklyStreakCard
      kind="training"
      recent={streak.training.recent}
      streak={streak.training.streak}
    />
  );
}
