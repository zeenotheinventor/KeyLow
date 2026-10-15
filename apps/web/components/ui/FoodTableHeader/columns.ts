// The diary table's columns as the board draws them: the food takes what is left, then protein,
// carbs and fat at 64 px, energy at 96 px and 80 px for the row's Edit and Delete buttons. The header
// and every row use this one list, so the columns line up.
export const foodTableColumnsClassName =
  "grid grid-cols-[minmax(0,1fr)_64px_64px_64px_96px_80px] items-center px-4";
