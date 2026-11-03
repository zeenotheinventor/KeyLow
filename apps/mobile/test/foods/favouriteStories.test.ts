import * as foodsStories from "../../components/FoodSearch/FavouriteFoods/FavouriteFoods.stories";
import { storyStates as foodsStates } from "../../components/FoodSearch/FavouriteFoods/storyStates";
import * as tileStories from "../../components/FoodSearch/FavouriteTile/FavouriteTile.stories";
import { storyStates as tileStates } from "../../components/FoodSearch/FavouriteTile/storyStates";

// The stories import the theme, which reads the saved Appearance setting.
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

const storyNames = (stories: Record<string, unknown>) =>
  Object.keys(stories)
    .filter((name) => name !== "default")
    .sort();

describe("the Favourites strip's stories", () => {
  it("should have a story for each state of the tile and no other", () => {
    expect(storyNames(tileStories)).toEqual([...tileStates].sort());
  });

  it("should have a story for each state of the strip and no other", () => {
    expect(storyNames(foodsStories)).toEqual([...foodsStates].sort());
  });
});
