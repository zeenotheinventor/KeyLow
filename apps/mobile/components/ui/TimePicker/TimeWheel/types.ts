export type TimeWheelProps = {
  /** Names the wheel for a screen reader: "Hours" or "Minutes". */
  label: string;
  /** How many rows it has, counting from 0: 24 for the hours and 60 for the minutes. */
  count: number;
  /** The chosen row. The wheel is controlled, so the screen keeps it. */
  value: number;
  onChange: (value: number) => void;
};
