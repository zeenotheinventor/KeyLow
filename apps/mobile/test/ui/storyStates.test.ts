import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

// The stories import the theme, which reads the saved Appearance setting.
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

const kitDirectory = path.join(__dirname, "..", "..", "components", "ui");

// Every primitive in the kit lists the states it must have a story for, by the name of the story's export,
// in a `storyStates.ts` beside its stories file. A primitive without that file, or a state without its
// story, fails here, so a state cannot be left out of Storybook without the build saying so. There is
// no shared list to edit: a new primitive brings its own file.
//
// States come from the design system card of the component and from the states the approved boards
// use. A press is an interaction and not a state a story can hold, so it is covered by the component
// tests and photographed on a device by holding the button down.

// The modules are found by folder name, so their exports are typed loosely here.
type StoryModule = Record<string, unknown>;
type StoryStatesModule = { storyStates: string[] };

const primitives = readdirSync(kitDirectory, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

describe("the kit's story states", () => {
  it("should find the kit's primitives", () => {
    expect(primitives.length).toBeGreaterThan(0);
  });

  describe.each(primitives)("%s", (primitive) => {
    const folder = path.join(kitDirectory, primitive);
    const storyFile = path.join(folder, `${primitive}.stories.tsx`);
    const statesFile = path.join(folder, "storyStates.ts");

    it("should have a story file", () => {
      expect(readdirSync(folder)).toContain(`${primitive}.stories.tsx`);
    });

    it("should list the states it must have a story for in storyStates.ts", () => {
      expect(readdirSync(folder)).toContain("storyStates.ts");
    });

    if (!existsSync(statesFile) || !existsSync(storyFile)) {
      return;
    }

    const { storyStates } = jest.requireActual<StoryStatesModule>(statesFile);

    it.each(storyStates)("should have a story for the %s state", (state) => {
      const storyModule = jest.requireActual<StoryModule>(storyFile);

      expect(storyModule).toHaveProperty(state);
    });

    it("should not have a story its storyStates.ts does not list, so the list stays the whole truth", () => {
      const storyModule = jest.requireActual<StoryModule>(storyFile);
      const stories = Object.keys(storyModule).filter((name) => name !== "default");

      expect([...stories].sort()).toEqual([...storyStates].sort());
    });
  });
});
