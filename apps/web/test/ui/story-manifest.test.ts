/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";

// Every primitive in the kit lists the states it must have a story for, by the name of the story's
// export, in a `storyStates.ts` beside its stories file. A folder without that list or without stories,
// a state without its story and a story its list does not name all fail here, so a state cannot be
// dropped or left out of the list without the build saying so. States come from the design-system card
// for the component plus the states the approved boards use.
//
// Vite reads the folders, so there is no shared list to edit: a new primitive brings its own files.
const kitIndexes = import.meta.glob("../../components/ui/*/index.ts");
const storyModules = import.meta.glob("../../components/ui/*/*.stories.tsx", { eager: true });
const storyStatesModules = import.meta.glob("../../components/ui/*/storyStates.ts", {
  eager: true,
});

const folderOf = (filePath: string) => filePath.split("/").at(-2) ?? filePath;

function isStoryStatesModule(value: unknown): value is { storyStates: string[] } {
  return typeof value === "object" && value !== null && "storyStates" in value;
}

function isStoryModule(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const kitFolders = Object.keys(kitIndexes).map(folderOf).sort();
const storyModuleByFolder = new Map(
  Object.entries(storyModules).map(([filePath, module]) => [folderOf(filePath), module]),
);
const storyStatesByFolder = new Map(
  Object.entries(storyStatesModules).flatMap(([filePath, module]) =>
    isStoryStatesModule(module) ? [[folderOf(filePath), module.storyStates] as const] : [],
  ),
);

describe("the kit's story states", () => {
  it("should find the kit's folders", () => {
    expect(kitFolders.length).toBeGreaterThan(0);
  });

  it("should have a stories file in every kit folder", () => {
    expect(kitFolders.filter((folder) => !storyModuleByFolder.has(folder))).toEqual([]);
  });

  it("should have a storyStates.ts in every kit folder", () => {
    expect(kitFolders.filter((folder) => !storyStatesByFolder.has(folder))).toEqual([]);
  });

  describe.each(kitFolders)("%s", (folder) => {
    const states = storyStatesByFolder.get(folder) ?? [];
    const storyModule = storyModuleByFolder.get(folder);
    const stories = isStoryModule(storyModule)
      ? Object.keys(storyModule).filter((name) => name !== "default")
      : [];

    it.each(states)("should have a story for the %s state", (state) => {
      expect(stories).toContain(state);
    });

    it("should not have a story its storyStates.ts does not list", () => {
      expect(stories.filter((story) => !states.includes(story))).toEqual([]);
    });
  });
});
