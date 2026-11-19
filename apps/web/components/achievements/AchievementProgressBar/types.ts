export type AchievementProgressBarProps = {
  /** What the bar measures, which names it: "Progress to the next level". */
  label: string;
  /** How far along, from 0 to `max`. */
  value: number;
  max: number;
  className?: string;
};
