import { readdirSync } from "node:fs";
import path from "node:path";

import { composeStories, composeStory } from "@storybook/react";
import { render, screen, waitFor } from "@testing-library/react-native";

import * as previewModule from "../.rnstorybook/preview";

import type { ThemeScheme } from "@keylow/tokens";

// The real provider renders nothing until the device reports its insets.
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: () => Promise.resolve(null),
    setItem: () => Promise.resolve(),
  },
}));

const componentsDirectory = path.join(__dirname, "..", "components");
const storyFilePattern = /\.stories\.(ts|tsx)$/;

// The same glob as .rnstorybook/main.ts, so a story that Storybook lists is a story this test renders.
const storyFiles = readdirSync(componentsDirectory, { recursive: true, encoding: "utf8" })
  .filter((file) => storyFilePattern.test(file))
  .sort();

type StoryModule = Parameters<typeof composeStories>[0];
type ComposedStory = ReturnType<typeof composeStory>;

// A story module's exports are typed loosely here, because the files are found at run time.
function isComposedStory(value: unknown): value is ComposedStory {
  return typeof value === "function";
}

const schemes: ThemeScheme[] = ["dark", "light"];

describe("stories", () => {
  it("should find at least one story file", () => {
    expect(storyFiles.length).toBeGreaterThan(0);
  });

  describe.each(schemes)("in the %s scheme", (scheme) => {
    describe.each(storyFiles)("%s", (storyFile) => {
      const storyModule = jest.requireActual<StoryModule>(
        path.join(componentsDirectory, storyFile),
      );
      const stories = composeStories(storyModule, {
        ...previewModule.default,
        initialGlobals: { theme: scheme },
      });

      it.each(Object.entries(stories))("should render the %s story", async (storyName, Story) => {
        if (!isComposedStory(Story)) {
          throw new Error(`${storyName} is not a story`);
        }

        await render(<Story />);

        // The decorator draws nothing until the theme provider has switched to the scheme, so a story that
        // never reaches the screen fails here.
        await waitFor(() => {
          expect(screen.toJSON()).not.toBeNull();
        });
      });
    });
  });
});
