import "./support/gestureHandler";

import { readdirSync } from "node:fs";
import path from "node:path";

import { composeStories, composeStory } from "@storybook/react";
import { render, screen, waitFor } from "@testing-library/react-native";
import { createElement, isValidElement } from "react";

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

// GL does not run in Jest, and the canvas module brings in three, which Jest does not transform. The 3D
// body's story renders its figure with nothing in it.
jest.mock("../components/ui/Body3D/Body3DCanvas", () => ({ Body3DCanvas: () => null }));

// Jest does not turn the library's scroll handlers into worklets, so a story with a sheet that scrolls would
// not render. The plain scroll view stands in for the library's, as it does in the sheets' own tests.
jest.mock("@gorhom/bottom-sheet", () =>
  jest
    .requireActual<{ mockBottomSheet: () => unknown }>("./support/sheetScrollViewMock")
    .mockBottomSheet(),
);

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

// The dark scheme renders every story file. The light scheme renders only the files below, whose rendered tree
// reaches a component that branches on the scheme, so the light pass has code of its own to run. Any other
// story draws the same tree in both schemes, and only the theme's values differ, which `packages/tokens` guards.
// The components that branch: ActionMenuItem (`dark:` label), Badge (text by scheme), Body3D (palette and
// lighting), BodyFigure (palette), BodyStage and BodyViewIn3D (the 3D scope's scheme), CheckboxLink and Toast
// (ink by scheme) and TabItem (selected label by scheme). The files are found from the import graph of each story.
const storyFilesWithSchemeCode = new Map([
  [
    "ArchivedRecipesView/ArchivedRecipesView.stories.tsx",
    "ActionMenuItem and Badge branch on the scheme",
  ],
  ["BodyCompositionCard/BodyCompositionCard.stories.tsx", "Badge branches on the scheme"],
  ["BodyCompositionView/BodyCompositionView.stories.tsx", "Badge branches on the scheme"],
  [
    "BodyMapCard/BodyMapCard.stories.tsx",
    "Badge, Body3D, BodyFigure, BodyStage and BodyViewIn3D branch on the scheme",
  ],
  ["BodyView/BodyView.stories.tsx", "Body3D, BodyFigure and BodyViewIn3D branch on the scheme"],
  [
    "DashboardBodyChartSetting/DashboardBodyChartSetting.stories.tsx",
    "Badge branches on the scheme",
  ],
  [
    "DashboardScreen/DashboardBodyMapCard/DashboardBodyMapCard.stories.tsx",
    "BodyFigure branches on the scheme",
  ],
  [
    "ExerciseMusclesSheet/ExerciseMusclesSheet.stories.tsx",
    "Badge, Body3D, BodyFigure, BodyStage and BodyViewIn3D branch on the scheme",
  ],
  ["ExerciseProgressView/ExerciseProgressView.stories.tsx", "Badge branches on the scheme"],
  ["FoodDetail/MacroHero/MacroHero.stories.tsx", "Badge branches on the scheme"],
  ["MusclesTrainedCard/MusclesTrainedCard.stories.tsx", "BodyFigure branches on the scheme"],
  [
    "RecipeLibraryView/RecipeLibraryView.stories.tsx",
    "ActionMenuItem and Badge branch on the scheme",
  ],
  ["RecipeRowMenu/RecipeRowMenu.stories.tsx", "ActionMenuItem and Badge branch on the scheme"],
  ["RoutineCard/RoutineCard.stories.tsx", "Badge branches on the scheme"],
  ["RoutineProgressDay/RoutineProgressDay.stories.tsx", "Badge branches on the scheme"],
  ["RoutinesView/RoutinesView.stories.tsx", "Badge branches on the scheme"],
  ["ShoppingItemRow/ShoppingItemRow.stories.tsx", "CheckboxLink branches on the scheme"],
  ["ShoppingListView/ShoppingListView.stories.tsx", "CheckboxLink branches on the scheme"],
  ["TodayCard/TodayCard.stories.tsx", "Badge branches on the scheme"],
  [
    "TrainScreen/TrainBodyMapCard/TrainBodyMapCard.stories.tsx",
    "BodyFigure branches on the scheme",
  ],
  ["WeightTrendCard/WeightTrendCard.stories.tsx", "Badge branches on the scheme"],
  ["ui/ActionMenu/ActionMenu.stories.tsx", "ActionMenuItem branches on the scheme"],
  ["ui/AssistantActionCard/AssistantActionCard.stories.tsx", "Badge branches on the scheme"],
  ["ui/Badge/Badge.stories.tsx", "Badge branches on the scheme"],
  ["ui/Body3D/Body3D.stories.tsx", "Body3D and BodyFigure branch on the scheme"],
  ["ui/BodyFigure/BodyFigure.stories.tsx", "BodyFigure branches on the scheme"],
  ["ui/Card/Card.stories.tsx", "Badge branches on the scheme"],
  ["ui/ChatMessage/ChatMessage.stories.tsx", "Badge branches on the scheme"],
  ["ui/Checkbox/Checkbox.stories.tsx", "CheckboxLink branches on the scheme"],
  ["ui/GroupedList/GroupedList.stories.tsx", "Badge branches on the scheme"],
  ["ui/ListRow/ListRow.stories.tsx", "Badge branches on the scheme"],
  ["ui/MacroTile/MacroTile.stories.tsx", "Badge branches on the scheme"],
  ["ui/OptionCard/OptionCard.stories.tsx", "Badge branches on the scheme"],
  ["ui/SearchLauncher/SearchLauncher.stories.tsx", "TabItem branches on the scheme"],
  ["ui/TabBar/TabBar.stories.tsx", "TabItem branches on the scheme"],
  ["ui/Toast/Toast.stories.tsx", "Toast branches on the scheme"],
]);

function storyFilesFor(scheme: ThemeScheme): string[] {
  return scheme === "dark"
    ? storyFiles
    : storyFiles.filter((storyFile) => storyFilesWithSchemeCode.has(storyFile));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// A story is an object, or a function with `args` set on it when it is written in the older style.
function readArgs(story: unknown): unknown {
  if (typeof story === "function" && "args" in story) {
    return story.args;
  }
  return isRecord(story) ? story.args : undefined;
}

// The paths, such as `args.leading` or `args.items[1].icon`, of every React element found anywhere inside a
// value. The values on the way down are tracked, so an arg that refers back to itself is skipped.
function findElementPaths(value: unknown, valuePath: string, ancestors: Set<unknown>): string[] {
  if (isValidElement(value)) {
    return [valuePath];
  }
  if (typeof value !== "object" || value === null || ancestors.has(value)) {
    return [];
  }
  ancestors.add(value);
  const elementPaths = Array.isArray(value)
    ? value.flatMap((item, index) => findElementPaths(item, `${valuePath}[${index}]`, ancestors))
    : Object.entries(value).flatMap(([key, item]) =>
        findElementPaths(item, `${valuePath}.${key}`, ancestors),
      );
  ancestors.delete(value);
  return elementPaths;
}

function findElementArgs(storyFile: string, storyModule: Record<string, unknown>): string[] {
  const { default: meta, ...stories } = storyModule;
  const entries: [string, unknown][] = [
    ["meta", readArgs(meta)],
    ...Object.entries(stories).map(([storyName, story]): [string, unknown] => [
      storyName,
      readArgs(story),
    ]),
  ];
  return entries.flatMap(([storyName, args]) =>
    findElementPaths(args, "args", new Set()).map(
      (elementPath) => `${storyFile} "${storyName}" has a React element at ${elementPath}`,
    ),
  );
}

describe("the element guard", () => {
  const element = createElement("View");

  it("should name the arg path of an element nested in an array and an object", () => {
    const storyModule = { default: {}, Nested: { args: { items: [{ icon: element }] } } };

    expect(findElementArgs("a.stories.tsx", storyModule)).toEqual([
      'a.stories.tsx "Nested" has a React element at args.items[0].icon',
    ]);
  });

  it("should read the args of a story written as a function", () => {
    const functionStory = Object.assign(() => null, { args: { leading: element } });

    expect(findElementArgs("a.stories.tsx", { default: {}, Legacy: functionStory })).toEqual([
      'a.stories.tsx "Legacy" has a React element at args.leading',
    ]);
  });

  it("should name the meta args without a trailing dot when the args are an element", () => {
    expect(findElementArgs("a.stories.tsx", { default: { args: element } })).toEqual([
      'a.stories.tsx "meta" has a React element at args',
    ]);
  });

  it("should skip an arg that refers back to itself", () => {
    const cyclic: Record<string, unknown> = { label: "Add" };
    cyclic.self = cyclic;

    expect(findElementArgs("a.stories.tsx", { default: { args: cyclic } })).toEqual([]);
  });
});

describe("stories", () => {
  it("should find at least one story file", () => {
    expect(storyFiles.length).toBeGreaterThan(0);
  });

  // Storybook walks every arg to infer its type. A React element reaches a router context whose getters throw,
  // which fails the whole story index on a device. Draw element content in `render` instead.
  it("should keep React elements out of every story's args", () => {
    const elementArgs = storyFiles.flatMap((storyFile) =>
      findElementArgs(storyFile, jest.requireActual(path.join(componentsDirectory, storyFile))),
    );

    expect(elementArgs).toEqual([]);
  });

  it("should list only story files that exist for the light scheme", () => {
    expect(
      [...storyFilesWithSchemeCode.keys()].filter((file) => !storyFiles.includes(file)),
    ).toEqual([]);
  });

  describe.each(schemes)("in the %s scheme", (scheme) => {
    describe.each(storyFilesFor(scheme))("%s", (storyFile) => {
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
