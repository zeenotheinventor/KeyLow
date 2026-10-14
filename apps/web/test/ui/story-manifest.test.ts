import { readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import * as badgeStories from "@/components/ui/Badge/Badge.stories";
import * as buttonStories from "@/components/ui/button.stories";
import * as cardStories from "@/components/ui/card.stories";
import * as inputStories from "@/components/ui/input.stories";
import * as searchFieldStories from "@/components/ui/SearchField/SearchField.stories";
import { storyManifest } from "@/components/ui/storyManifest";

const storyModules: Record<string, object> = {
  "Badge/Badge.stories.tsx": badgeStories,
  "button.stories.tsx": buttonStories,
  "card.stories.tsx": cardStories,
  "input.stories.tsx": inputStories,
  "SearchField/SearchField.stories.tsx": searchFieldStories,
};

const uiDirectory = join(__dirname, "../../components/ui");

describe("storyManifest", () => {
  it("should list every primitive that has a stories file", () => {
    const storyFiles = readdirSync(uiDirectory, { recursive: true, encoding: "utf8" })
      .filter((name) => name.endsWith(".stories.tsx"))
      .sort();

    expect(Object.keys(storyManifest).sort()).toEqual(storyFiles);
  });

  it("should have a stories module for every primitive in the manifest", () => {
    expect(Object.keys(storyModules).sort()).toEqual(Object.keys(storyManifest).sort());
  });

  describe.each(Object.entries(storyManifest))("%s", (file, states) => {
    it.each(states)("should have a story for the %s state", (state) => {
      expect(Object.keys(storyModules[file] ?? {})).toContain(state);
    });
  });
});
