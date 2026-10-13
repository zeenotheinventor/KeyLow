/**
 * Stacked protein, carbs and fat bars with grams over target
 * @startingPoint section="Data" subtitle="Stacked protein, carbs and fat bars with grams over target" viewport="360x110"
 */
export interface MacroBarsProps {
  protein: { eaten: number; target: number };
  carbs: { eaten: number; target: number };
  fat: { eaten: number; target: number };
  compact?: boolean;
  style?: React.CSSProperties;
}

export declare function MacroBars(props: MacroBarsProps): JSX.Element;
