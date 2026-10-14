/**
 * The foods whose name or brand contains every word of the query, in the order given. It is a plain
 * substring match with no pattern built from the query. Nothing typed keeps every food.
 */
export function filterOwnFoods<Food extends { name: string; brand: string | null }>(
  foods: readonly Food[],
  query: string,
): Food[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);

  return foods.filter((food) => {
    const text = `${food.name} ${food.brand ?? ""}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}
