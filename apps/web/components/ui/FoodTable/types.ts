import type { ReactNode } from "react";

export type FoodTableProps = {
  /** Names the table for assistive technology, such as the hour it holds: "Foods at 08:00". */
  label: string;
  /** The rows: `FoodRow`s with `layout="table"`. */
  children: ReactNode;
};
