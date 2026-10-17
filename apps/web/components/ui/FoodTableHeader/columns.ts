// The diary table's columns as the board draws them: the food takes what is left, then protein,
// carbs and fat at 64 px, energy at 96 px and 80 px for the row's Edit and Delete buttons. The header
// and every row use this one list, so the columns line up.
export const foodTableColumnsClassName =
  "grid grid-cols-[minmax(0,1fr)_64px_64px_64px_96px_80px] items-center px-4";

// The recipe library's: the recipe takes what is left, then servings, protein, carbs and fat at 80 px,
// energy at 96 px and 232 px for the row's buttons.
export const recipeTableColumnsClassName =
  "grid grid-cols-[minmax(0,1fr)_80px_80px_80px_80px_96px_232px] items-center px-4";
