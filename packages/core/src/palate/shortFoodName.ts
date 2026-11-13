/** What a sentence calls a food: its name up to the first comma, in lower case ("Eggs, chicken, whole, boiled" is "eggs"). */
export const shortFoodName = (name: string): string => {
  const firstPart = (name.split(",")[0] ?? "").trim();
  return (firstPart === "" ? name.trim() : firstPart).toLowerCase();
};
