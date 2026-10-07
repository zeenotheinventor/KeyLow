import type { NutrientTableProps } from "./types";

import { basisUnit, formatAmount } from "@/components/foods/foodDisplay";

const NOT_GIVEN = "not given";

export function NutrientTable({ food }: NutrientTableProps) {
  const rows = [
    { label: "Energy", amount: food.kcal, unit: "kcal" },
    { label: "Protein", amount: food.protein_g, unit: "g" },
    { label: "Fat", amount: food.fat_g, unit: "g" },
    { label: "Carbohydrate", amount: food.carbs_g, unit: "g" },
    { label: "Fibre", amount: food.fibre_g, unit: "g" },
  ];

  return (
    <table className="w-full text-sm">
      <caption className="pb-2 text-left font-semibold">
        {`Nutrients per 100 ${basisUnit(food.basis)}`}
      </caption>
      <tbody>
        {rows.map(({ label, amount, unit }) => (
          <tr key={label} className="border-t">
            <th scope="row" className="py-2 pr-4 text-left font-normal">
              {label}
            </th>
            <td className="py-2 text-right">
              {amount === null ? NOT_GIVEN : `${formatAmount(amount)} ${unit}`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
