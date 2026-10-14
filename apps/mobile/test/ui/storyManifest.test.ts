import { readdirSync } from "node:fs";
import path from "node:path";

import { storyManifest } from "../../components/ui/storyManifest";

// The stories import the theme, which reads the saved Appearance setting.
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

const kitDirectory = path.join(__dirname, "..", "..", "components", "ui");

// A story module's exports are typed loosely here, because the files are found by the manifest.
type StoryModule = Record<string, unknown>;

const primitives = Object.entries(storyManifest);

describe("the kit's story manifest", () => {
  it("should list every primitive in components/ui, so a new one cannot skip its stories", () => {
    const kitFolders = readdirSync(kitDirectory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    expect(Object.keys(storyManifest).sort()).toEqual(kitFolders);
  });

  describe.each(primitives)("%s", (primitive, { states }) => {
    const storyFile = path.join(kitDirectory, primitive, `${primitive}.stories.tsx`);

    it("should have a story file", () => {
      expect(readdirSync(path.join(kitDirectory, primitive))).toContain(`${primitive}.stories.tsx`);
    });

    it.each(states)("should have a story for the %s state", (state) => {
      const storyModule = jest.requireActual<StoryModule>(storyFile);

      expect(storyModule).toHaveProperty(state);
    });

    it("should not have a story the manifest does not list, so the manifest stays the whole truth", () => {
      const storyModule = jest.requireActual<StoryModule>(storyFile);
      const stories = Object.keys(storyModule).filter((name) => name !== "default");

      expect([...stories].sort()).toEqual([...states].sort());
    });
  });
});
