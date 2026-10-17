/**
 * The recipes whose name contains every word of the query, in the order given. It is a plain
 * substring match from the first character, with no pattern built from the query. Nothing typed
 * keeps every recipe.
 */
export const filterRecipesByName = <Row extends { name: string }>(
  recipes: readonly Row[],
  query: string,
): Row[] => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);

  return recipes.filter((recipe) => {
    const name = recipe.name.toLowerCase();
    return words.every((word) => name.includes(word));
  });
};
