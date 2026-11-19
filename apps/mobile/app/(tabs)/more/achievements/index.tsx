import { AchievementsScreen } from "../../../../components/AchievementsScreen";

// Pushed inside the More tab from the Achievements row. The root layout's AuthGate covers it, and the stack above
// gives it no header.
export default function AchievementsRoute() {
  return <AchievementsScreen />;
}
