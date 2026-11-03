/**
 * Live favourite foods one person holds. The `food_favourites` trigger in the database enforces the
 * same number, so the two must change together. A favourite whose food is soft deleted is not counted.
 */
export const MAX_FAVOURITE_FOODS = 30;
