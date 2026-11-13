import { KeyLowProvider } from "@keylow/api-client";
import { ASSISTANT_CONSENT_VERSION } from "@keylow/core";
import { act, render, screen, userEvent, waitFor, within } from "@testing-library/react-native";
import { Text } from "react-native";

import { deviceScheme } from "./support/deviceScheme";
import {
  createDiaryQueryClient,
  diaryBackend,
  noTargets,
  requestsTo,
  resetDiaryBackend,
} from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import {
  programClient,
  resetProgramBackend,
  showGoldenProgram,
  showProgramWithoutSnapshot,
} from "./support/programBackend";
import { mockSupabaseClient, resetSupabaseMock } from "./support/supabaseMock";
import { storedGoalRow } from "./support/trainingGoalsRead";
import { installVirtualClock } from "./support/virtualClock";
import MoreRoute from "../app/(tabs)/more";
import { resetBodyFigureForTests } from "../lib/bodyFigure/testing";
import { useBodyMapRenderer } from "../lib/bodyMapRenderer";
import { resetBodyMapRendererForTests } from "../lib/bodyMapRenderer/testing";
import { useDashboardBodyChart } from "../lib/dashboardBodyChart";
import { resetDashboardBodyChartForTests } from "../lib/dashboardBodyChart/testing";
import { useFormMediaPreference } from "../lib/formMediaPreference";
import { resetFormMediaPreferenceForTests } from "../lib/formMediaPreference/testing";
import { suggestionsPreferenceStorageKey } from "../lib/suggestionsPreference";
import { ThemeProvider, useTheme } from "../lib/theme";

const mockStorageItems = new Map<string, string>();
const mockSetItem = jest.fn((key: string, value: string) => {
  mockStorageItems.set(key, value);
  return Promise.resolve();
});

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => Promise.resolve(mockStorageItems.get(key) ?? null),
    setItem: (key: string, value: string) => mockSetItem(key, value),
  },
}));
jest.mock(
  "react-native/Libraries/Utilities/useColorScheme",
  () =>
    jest.requireActual<typeof import("./support/deviceScheme")>("./support/deviceScheme")
      .mockDeviceSchemeHook,
);
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
jest.mock("../lib/supabase", () => ({
  supabase: jest.requireActual<{ mockSupabaseClient: unknown }>("./support/supabaseMock")
    .mockSupabaseClient,
}));

// Shows the theme the screen has set, which the segments alone do not prove.
function ThemeProbe() {
  const { scheme, preference } = useTheme();

  return <Text>{`scheme:${scheme} preference:${preference}`}</Text>;
}

// Shows the renderer a mounted reader of the body map's preference sees, which the segments alone do not prove.
function BodyMapRendererProbe() {
  const { renderer } = useBodyMapRenderer();

  return <Text>{`body map renderer:${renderer}`}</Text>;
}

// Shows the chart a mounted reader of the dashboard's choice sees, which the segments alone do not prove.
function DashboardBodyChartProbe() {
  const { chart } = useDashboardBodyChart();

  return <Text>{`dashboard body chart:${chart}`}</Text>;
}

// Shows the preference a mounted reader of the exercise demos choice sees, which the segments alone do not prove.
function FormMediaPreferenceProbe() {
  const { preference } = useFormMediaPreference();

  return <Text>{`form media preference:${preference}`}</Text>;
}

type Instance = NonNullable<ReturnType<typeof screen.getByRole>>;

function isInside(node: Instance | null, ancestor: Instance): boolean {
  return node !== null && (node === ancestor || isInside(node.parent, ancestor));
}

// Icons are decoration with no role, so the drawings in a row are counted: its icon, and its chevron if it has one.
function drawingsIn(row: Instance) {
  return screen.root?.queryAll((node) => node.type === "RNSVGSvgView" && isInside(node, row)) ?? [];
}

async function renderMore() {
  await render(
    <ThemeProvider>
      <KeyLowProvider client={programClient} queryClient={createDiaryQueryClient()}>
        <MoreRoute />
        <ThemeProbe />
        <BodyMapRendererProbe />
        <DashboardBodyChartProbe />
        <FormMediaPreferenceProbe />
      </KeyLowProvider>
    </ThemeProvider>,
  );
  await screen.findByRole("heading", { name: "More" });
}

describe("the More screen", () => {
  beforeEach(() => {
    installVirtualClock();
    resetRouterMock();
    resetSupabaseMock();
    resetDiaryBackend();
    resetProgramBackend();
    mockStorageItems.clear();
    mockSetItem.mockClear();
    resetBodyMapRendererForTests();
    resetDashboardBodyChartForTests();
    resetFormMediaPreferenceForTests();
    resetBodyFigureForTests();
    deviceScheme.current = "light";
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("its sections", () => {
    it("should be headed More, over Food, Nutrition, Body, Settings and Account in that order", async () => {
      await renderMore();

      const headings = screen.getAllByRole("heading");

      expect(headings).toHaveLength(6);
      ["More", "Food", "Nutrition", "Body", "Settings", "Account"].forEach((name, index) => {
        expect(headings[index]).toHaveTextContent(name);
      });
    });

    it("should have one Recipes row, in Nutrition, as Recipes is no longer a tab", async () => {
      await renderMore();

      expect(screen.getAllByRole("button", { name: "Recipes" })).toHaveLength(1);
      expect(
        within(screen.getByLabelText("Nutrition")).getByRole("button", { name: "Recipes" }),
      ).toBeOnTheScreen();
    });
  });

  describe("Your foods", () => {
    it("should be an enabled row with its subtitle", async () => {
      await renderMore();

      const row = screen.getByRole("button", { name: "Your foods, Foods you created or copied" });

      expect(row).toBeEnabled();
    });

    it("should draw its icon and a chevron, because it goes somewhere", async () => {
      await renderMore();

      expect(drawingsIn(screen.getByRole("button", { name: /^Your foods/ }))).toHaveLength(2);
    });

    it("should open the search sheet in Your foods mode when pressed", async () => {
      const user = userEvent.setup();
      await renderMore();

      await user.press(screen.getByRole("button", { name: /^Your foods/ }));

      expect(routerMock.push).toHaveBeenCalledWith("/foods?scope=own");
    });
  });

  describe("Targets", () => {
    it("should be an enabled row in Nutrition that shows the calorie target once it is read", async () => {
      await renderMore();

      const row = await screen.findByRole("button", { name: "Targets, Set by you, 2,200 kcal" });

      expect(within(screen.getByLabelText("Nutrition")).getAllByRole("button")[0]).toBe(row);
      expect(row).toBeEnabled();
    });

    it("should show no value when no target is set", async () => {
      diaryBackend.targets = noTargets;
      await renderMore();

      expect(await screen.findByRole("button", { name: "Targets, Set by you" })).toBeEnabled();
    });

    it("should open the Targets screen when pressed", async () => {
      const user = userEvent.setup();
      await renderMore();

      await user.press(await screen.findByRole("button", { name: /^Targets/ }));

      expect(routerMock.push).toHaveBeenCalledWith("/targets");
    });

    it("should read no targets while the terms are not accepted", async () => {
      diaryBackend.terms = { terms_accepted_at: null, terms_version: null };
      await renderMore();

      expect(await screen.findByRole("button", { name: "Targets, Set by you" })).toBeEnabled();
      expect(
        diaryBackend.requests.filter((request) => !request.search.includes("terms_accepted_at")),
      ).toEqual([]);
      expect(requestsTo("profiles")).toBe(1);
    });
  });

  describe("Programme", () => {
    it("should be a row in Nutrition under Targets, with its icon and a chevron because it goes somewhere", async () => {
      await renderMore();

      const nutrition = within(screen.getByLabelText("Nutrition"));
      const rows = nutrition.getAllByRole("button");

      expect(rows).toHaveLength(3);
      expect(rows[0]).toHaveAccessibleName(/^Targets/);
      expect(rows[1]).toHaveAccessibleName(/^Programme/);
      expect(drawingsIn(nutrition.getByRole("button", { name: /^Programme/ }))).toHaveLength(2);
    });

    it("should offer to set the targets when there is no programme", async () => {
      await renderMore();

      expect(
        await screen.findByRole("button", { name: "Programme, Let Ki-Lo set your targets" }),
      ).toBeEnabled();
    });

    it("should say when the next check-in is while a programme runs", async () => {
      showGoldenProgram();
      await renderMore();

      expect(
        await screen.findByRole("button", { name: "Programme, Next check-in Fri 30 Oct" }),
      ).toBeEnabled();
    });

    it("should say nothing under its title while a programme has no check-in date yet", async () => {
      showProgramWithoutSnapshot();
      await renderMore();
      // The recompute has not made the programme's targets yet, so these are the ones the wizard saved.
      await screen.findByRole("button", { name: "Targets, Set by you, 1,970 kcal" });

      expect(screen.getByRole("button", { name: "Programme" })).toBeEnabled();
    });

    it("should open the Programme screen inside the More tab when pressed", async () => {
      const user = userEvent.setup();
      await renderMore();

      await user.press(await screen.findByRole("button", { name: /^Programme/ }));

      expect(routerMock.push).toHaveBeenCalledWith("/more/program");
    });

    it("should read nothing while the terms are not accepted", async () => {
      diaryBackend.terms = { terms_accepted_at: null, terms_version: null };
      await renderMore();

      expect(await screen.findByRole("button", { name: "Programme" })).toBeEnabled();
      expect(requestsTo("expenditure_snapshots")).toBe(0);
    });
  });

  describe("Recipes", () => {
    it("should be Nutrition's last row, after Programme, with its icon and a chevron", async () => {
      await renderMore();

      const nutrition = within(screen.getByLabelText("Nutrition"));
      const rows = nutrition.getAllByRole("button");

      expect(rows[2]).toHaveAccessibleName("Recipes");
      expect(rows[2]).toBeEnabled();
      expect(drawingsIn(nutrition.getByRole("button", { name: "Recipes" }))).toHaveLength(2);
    });

    it("should open the recipe library inside the More tab when pressed", async () => {
      const user = userEvent.setup();
      await renderMore();

      await user.press(await screen.findByRole("button", { name: "Recipes" }));

      expect(routerMock.push).toHaveBeenCalledTimes(1);
      expect(routerMock.push).toHaveBeenCalledWith("/more/recipes");
    });

    it("should open the library once on a double tap", async () => {
      const user = userEvent.setup();
      await renderMore();
      const row = await screen.findByRole("button", { name: "Recipes" });

      await user.press(row);
      await user.press(row);

      expect(routerMock.push).toHaveBeenCalledTimes(1);
    });
  });

  describe("Targets from a programme", () => {
    it("should say they come from the programme when the programme's targets are in force", async () => {
      showGoldenProgram();
      await renderMore();

      expect(
        await screen.findByRole("button", { name: "Targets, From your programme, 2,140 kcal" }),
      ).toBeEnabled();
    });

    it("should keep saying Set by you for targets the user typed", async () => {
      await renderMore();

      expect(
        await screen.findByRole("button", { name: "Targets, Set by you, 2,200 kcal" }),
      ).toBeEnabled();
    });
  });

  describe("Weight", () => {
    it("should be an enabled row in Body, named Weight, with its icon and a chevron because it goes somewhere", async () => {
      await renderMore();

      const row = within(screen.getByLabelText("Body")).getByRole("button", { name: "Weight" });

      expect(row).toBeEnabled();
      expect(drawingsIn(row)).toHaveLength(2);
    });

    it("should no longer say Coming soon", async () => {
      await renderMore();

      expect(screen.queryByText(/coming soon/i)).not.toBeOnTheScreen();
      expect(screen.queryByLabelText(/coming soon/i)).not.toBeOnTheScreen();
    });

    it("should open the Weight screen inside the More tab when pressed", async () => {
      const user = userEvent.setup();
      await renderMore();

      await user.press(screen.getByRole("button", { name: "Weight" }));

      expect(routerMock.push).toHaveBeenCalledWith("/more/weight");
    });
  });

  describe("Goal", () => {
    const withoutGoalSubtitle = "Tell Ki-Lo what you are training for";

    it("should be an enabled row in Body, after Weight, with its icon and a chevron because it goes somewhere", async () => {
      await renderMore();

      const body = within(screen.getByLabelText("Body"));
      const rows = body.getAllByRole("button");

      const goalRow = body.getByRole("button", { name: /^Goal/ });

      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveAccessibleName("Weight");
      expect(rows[1]).toBe(goalRow);
      expect(goalRow).toBeEnabled();
      expect(drawingsIn(goalRow)).toHaveLength(2);
    });

    it("should invite the user to say what they train for when there is no goal", async () => {
      await renderMore();

      expect(
        await screen.findByRole("button", { name: `Goal, ${withoutGoalSubtitle}` }),
      ).toBeEnabled();
    });

    it("should say when the goal was set, in the user's own day, once the goal is read", async () => {
      diaryBackend.trainingGoals = [storedGoalRow];
      await renderMore();

      expect(await screen.findByRole("button", { name: "Goal, Set on Mon 21 Sep" })).toBeEnabled();
      expect(screen.queryByText(withoutGoalSubtitle)).not.toBeOnTheScreen();
    });

    it("should say nothing under its title while the goal is being read, so no invitation flashes and flips", async () => {
      diaryBackend.hungTables.add("training_goals");
      await renderMore();
      // Targets arrive from the same fake database, so the reads of this screen have settled.
      await screen.findByRole("button", { name: "Targets, Set by you, 2,200 kcal" });

      expect(screen.getByRole("button", { name: "Goal" })).toBeEnabled();
      expect(screen.queryByText(withoutGoalSubtitle)).not.toBeOnTheScreen();
    });

    it("should say nothing under its title while the time zone the goal is dated in is being read", async () => {
      diaryBackend.trainingGoals = [storedGoalRow];
      diaryBackend.timeZoneReadHangs = true;
      await renderMore();
      await screen.findByRole("button", { name: "Targets, Set by you, 2,200 kcal" });

      expect(requestsTo("training_goals")).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: "Goal" })).toBeEnabled();
      expect(screen.queryByText(/^Set on /)).not.toBeOnTheScreen();
    });

    it("should say nothing under its title when the goal cannot be read, as it does not know there is none", async () => {
      diaryBackend.failingTables.add("training_goals");
      await renderMore();
      await screen.findByRole("button", { name: "Targets, Set by you, 2,200 kcal" });

      expect(screen.getByRole("button", { name: "Goal" })).toBeEnabled();
      expect(screen.queryByText(withoutGoalSubtitle)).not.toBeOnTheScreen();
    });

    it("should open the Goal screen when pressed, which asks the first question itself when there is no goal", async () => {
      const user = userEvent.setup();
      diaryBackend.trainingGoals = [storedGoalRow];
      await renderMore();

      await user.press(await screen.findByRole("button", { name: /^Goal/ }));

      expect(routerMock.push).toHaveBeenCalledTimes(1);
      expect(routerMock.push).toHaveBeenCalledWith("/goal");
    });

    it("should open the Goal screen even while the goal is still being read", async () => {
      const user = userEvent.setup();
      diaryBackend.hungTables.add("training_goals");
      await renderMore();

      await user.press(screen.getByRole("button", { name: "Goal" }));

      expect(routerMock.push).toHaveBeenCalledWith("/goal");
    });

    it("should open the questions once on a double tap", async () => {
      const user = userEvent.setup();
      await renderMore();
      const row = await screen.findByRole("button", { name: /^Goal/ });

      await user.press(row);
      await user.press(row);

      expect(routerMock.push).toHaveBeenCalledTimes(1);
    });
  });

  describe("Appearance", () => {
    it("should offer Dark, Light and Match device in a group named Appearance", async () => {
      await renderMore();

      // The row is named Appearance too, and the role query does not resolve a radiogroup, so the group is
      // the one of that name with the radiogroup role.
      const groups = screen
        .getAllByLabelText("Appearance")
        .filter((element) => element.props.role === "radiogroup");
      expect(groups).toHaveLength(1);
      const group = groups[0];
      if (group === undefined) {
        throw new Error("The Appearance group is missing");
      }

      expect(within(group).getAllByRole("radio")).toHaveLength(3);
      ["Dark", "Light", "Match device"].forEach((name) => {
        expect(within(group).getByRole("radio", { name })).toBeOnTheScreen();
      });
    });

    it("should start on Dark, which is the default", async () => {
      await renderMore();

      expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
      expect(screen.getByText("scheme:dark preference:dark")).toBeOnTheScreen();
    });

    it("should switch the live theme to light when Light is chosen", async () => {
      const user = userEvent.setup();
      await renderMore();

      await user.press(screen.getByRole("radio", { name: "Light" }));

      expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
      expect(screen.getByText("scheme:light preference:light")).toBeOnTheScreen();
    });

    it("should keep the choice for the next launch", async () => {
      const user = userEvent.setup();
      await renderMore();

      await user.press(screen.getByRole("radio", { name: "Light" }));

      expect(mockSetItem).toHaveBeenCalledWith("kl-theme", "light");
    });

    it("should show the saved choice when the screen opens on a later launch", async () => {
      mockStorageItems.set("kl-theme", "light");

      await renderMore();

      expect(await screen.findByRole("radio", { name: "Light" })).toBeChecked();
      expect(screen.getByText("scheme:light preference:light")).toBeOnTheScreen();
    });

    it.each(["light", "dark"] as const)(
      "should follow a %s device when Match device is chosen",
      async (device) => {
        const user = userEvent.setup();
        deviceScheme.current = device;
        await renderMore();

        await user.press(screen.getByRole("radio", { name: "Match device" }));

        expect(screen.getByRole("radio", { name: "Match device" })).toBeChecked();
        expect(screen.getByText(`scheme:${device} preference:system`)).toBeOnTheScreen();
        expect(mockSetItem).toHaveBeenCalledWith("kl-theme", "system");
      },
    );
  });

  describe("Body map", () => {
    const femaleNote =
      "3D draws the male body for now. Your figure is female, so the body map stays 2D.";

    it("should be a row in Settings, beside Appearance, over a 2D and 3D choice", async () => {
      await renderMore();

      // The role query does not resolve a radiogroup, so the group is the one of that name with the role.
      const groups = screen
        .getAllByLabelText("Body map")
        .filter((element) => element.props.role === "radiogroup");
      expect(groups).toHaveLength(1);
      const group = groups[0];
      if (group === undefined) {
        throw new Error("The Body map group is missing");
      }
      const radios = within(screen.getByLabelText("Settings")).getAllByRole("radio");

      expect(within(group).getAllByRole("radio")).toHaveLength(2);
      expect(within(group).getByRole("radio", { name: "2D" })).toBeOnTheScreen();
      expect(within(group).getByRole("radio", { name: "3D" })).toBeOnTheScreen();
      ["Dark", "Light", "Match device", "2D", "3D"].forEach((name, index) => {
        expect(radios[index]).toHaveAccessibleName(name);
      });
    });

    it("should have 2D selected on a fresh install", async () => {
      await renderMore();

      expect(screen.getByRole("radio", { name: "2D" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "3D" })).not.toBeChecked();
      expect(screen.getByText("body map renderer:2d")).toBeOnTheScreen();
    });

    it("should apply 3D at once to a mounted reader of the preference when 3D is chosen", async () => {
      const user = userEvent.setup();
      await renderMore();

      await user.press(screen.getByRole("radio", { name: "3D" }));

      expect(screen.getByRole("radio", { name: "3D" })).toBeChecked();
      expect(screen.getByText("body map renderer:3d")).toBeOnTheScreen();
    });

    it("should keep the choice for the next launch", async () => {
      const user = userEvent.setup();
      await renderMore();

      await user.press(screen.getByRole("radio", { name: "3D" }));

      expect(mockSetItem).toHaveBeenCalledWith("bodyMap.renderer", "3d");
    });

    it("should bring 2D back when 2D is chosen after 3D", async () => {
      const user = userEvent.setup();
      await renderMore();

      await user.press(screen.getByRole("radio", { name: "3D" }));
      await user.press(screen.getByRole("radio", { name: "2D" }));

      expect(screen.getByRole("radio", { name: "2D" })).toBeChecked();
      expect(screen.getByText("body map renderer:2d")).toBeOnTheScreen();
      expect(mockSetItem).toHaveBeenLastCalledWith("bodyMap.renderer", "2d");
    });

    it("should show the saved choice when the screen opens on a later launch", async () => {
      mockStorageItems.set("bodyMap.renderer", "3d");

      await renderMore();

      expect(await screen.findByRole("radio", { name: "3D" })).toBeChecked();
    });

    it("should say nothing about the figure for the male figure", async () => {
      mockStorageItems.set("bodyMap.figure", "male");
      await renderMore();
      // Lets the stored figure be read, so the absence is not just the first render.
      await act(async () => {});

      expect(screen.queryByText(femaleNote)).not.toBeOnTheScreen();
    });

    it("should say the body map stays 2D for the female figure, with 3D still the choice shown", async () => {
      const user = userEvent.setup();
      mockStorageItems.set("bodyMap.figure", "female");
      await renderMore();

      await user.press(screen.getByRole("radio", { name: "3D" }));

      expect(await screen.findByText(femaleNote)).toBeOnTheScreen();
      expect(screen.getByRole("radio", { name: "3D" })).toBeChecked();
    });
  });

  describe("Dashboard body map", () => {
    const heatCaption = "How hard and how recently each muscle worked, right now.";
    const volumeCaption = "Sets for each muscle this week, Monday to Sunday.";

    it("should be a row in Settings after Body map, over a Heat and Weekly volume choice", async () => {
      await renderMore();

      // The role query does not resolve a radiogroup, so the group is the one of that name with the role.
      const groups = screen
        .getAllByLabelText("Dashboard body map")
        .filter((element) => element.props.role === "radiogroup");
      expect(groups).toHaveLength(1);
      const group = groups[0];
      if (group === undefined) {
        throw new Error("The Dashboard body map group is missing");
      }
      const radios = within(screen.getByLabelText("Settings")).getAllByRole("radio");

      expect(within(group).getAllByRole("radio")).toHaveLength(2);
      ["Dark", "Light", "Match device", "2D", "3D", "Heat", "Weekly volume"].forEach(
        (name, index) => {
          expect(radios[index]).toHaveAccessibleName(name);
        },
      );
    });

    it("should have Heat selected on a fresh install, with the Heat caption under it", async () => {
      await renderMore();

      expect(screen.getByRole("radio", { name: "Heat" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "Weekly volume" })).not.toBeChecked();
      expect(screen.getByText(heatCaption)).toBeOnTheScreen();
      expect(screen.queryByText(volumeCaption)).not.toBeOnTheScreen();
    });

    it("should apply Weekly volume at once to a mounted reader, and change the caption", async () => {
      const user = userEvent.setup();
      await renderMore();

      await user.press(screen.getByRole("radio", { name: "Weekly volume" }));

      expect(screen.getByRole("radio", { name: "Weekly volume" })).toBeChecked();
      expect(screen.getByText("dashboard body chart:volume")).toBeOnTheScreen();
      expect(screen.getByText(volumeCaption)).toBeOnTheScreen();
      expect(screen.queryByText(heatCaption)).not.toBeOnTheScreen();
    });

    it("should keep the choice for the next launch", async () => {
      const user = userEvent.setup();
      await renderMore();

      await user.press(screen.getByRole("radio", { name: "Weekly volume" }));

      expect(mockSetItem).toHaveBeenCalledWith("dashboard.bodyChart", "volume");
    });

    it("should bring Heat back when Heat is chosen after Weekly volume", async () => {
      const user = userEvent.setup();
      await renderMore();

      await user.press(screen.getByRole("radio", { name: "Weekly volume" }));
      await user.press(screen.getByRole("radio", { name: "Heat" }));

      expect(screen.getByRole("radio", { name: "Heat" })).toBeChecked();
      expect(screen.getByText("dashboard body chart:heat")).toBeOnTheScreen();
      expect(mockSetItem).toHaveBeenLastCalledWith("dashboard.bodyChart", "heat");
    });

    it("should show the saved choice when the screen opens on a later launch", async () => {
      mockStorageItems.set("dashboard.bodyChart", "volume");

      await renderMore();

      expect(await screen.findByRole("radio", { name: "Weekly volume" })).toBeChecked();
      expect(screen.getByText(volumeCaption)).toBeOnTheScreen();
    });
  });

  describe("Exercise demos", () => {
    const videoCaption =
      "Shows the form video. When an exercise has no video, its photos show instead.";
    const photosCaption =
      "Shows the start and end photos. When an exercise has no photos, its video shows instead.";
    const bothCaption =
      "Shows the video with the start and end photos under it. When an exercise has only one, that one shows.";

    it("should be a radio group in Settings after the Dashboard body map, of Video, Photos and Both", async () => {
      await renderMore();

      const radios = within(screen.getByLabelText("Settings")).getAllByRole("radio");

      ["Heat", "Weekly volume", "Video", "Photos", "Both"].forEach((name, index) => {
        expect(radios[index + 5]).toHaveAccessibleName(name);
      });
      expect(
        screen
          .getAllByLabelText("Exercise demos")
          .filter((element) => element.props.role === "radiogroup"),
      ).toHaveLength(1);
    });

    it("should have Video selected on a fresh install, with the Video caption under it", async () => {
      await renderMore();

      expect(screen.getByRole("radio", { name: "Video" })).toBeChecked();
      expect(screen.getByText(videoCaption)).toBeOnTheScreen();
    });

    it("should select Photos at once, show its caption and tell a mounted reader", async () => {
      const user = userEvent.setup();
      await renderMore();

      await user.press(screen.getByRole("radio", { name: "Photos" }));

      expect(screen.getByRole("radio", { name: "Photos" })).toBeChecked();
      expect(screen.getByText(photosCaption)).toBeOnTheScreen();
      expect(screen.queryByText(videoCaption)).not.toBeOnTheScreen();
      expect(screen.getByText("form media preference:photos")).toBeOnTheScreen();
    });

    it("should show the Both caption and keep the choice for the next launch", async () => {
      const user = userEvent.setup();
      await renderMore();

      await user.press(screen.getByRole("radio", { name: "Both" }));

      expect(screen.getByText(bothCaption)).toBeOnTheScreen();
      expect(mockSetItem).toHaveBeenCalledWith("exerciseForm.mediaPreference", "both");
    });

    it("should show the saved choice when the screen opens on a later launch", async () => {
      mockStorageItems.set("exerciseForm.mediaPreference", "photos");

      await renderMore();

      expect(await screen.findByRole("radio", { name: "Photos" })).toBeChecked();
      expect(screen.getByText(photosCaption)).toBeOnTheScreen();
    });
  });

  describe("Assistant", () => {
    it("should be the first row in Settings, off until the person turns it on, with its icon and a chevron", async () => {
      await renderMore();

      const settings = within(screen.getByLabelText("Settings"));
      const row = await settings.findByRole("button", {
        name: "Assistant, Off until you turn it on, Off",
      });

      expect(row).toBeEnabled();
      expect(drawingsIn(row)).toHaveLength(2);
      expect(settings.getAllByRole("button")[0]).toBe(row);
      expect(within(row).getByText("Off until you turn it on")).toBeOnTheScreen();
      expect(within(row).getByText("Off")).toBeOnTheScreen();
    });

    it("should say On, with what the assistant does, once the person has turned it on", async () => {
      Object.assign(diaryBackend.terms, {
        assistant_consent_at: `${ASSISTANT_CONSENT_VERSION}T10:00:00Z`,
        assistant_consent_version: ASSISTANT_CONSENT_VERSION,
      });
      await renderMore();

      expect(
        await within(screen.getByLabelText("Settings")).findByRole("button", {
          name: "Assistant, Log and ask in your own words, On",
        }),
      ).toBeOnTheScreen();
    });

    it("should say Off when the person turned it on under older words, as the assistant asks them again", async () => {
      Object.assign(diaryBackend.terms, {
        assistant_consent_at: "2026-10-26T10:00:00Z",
        assistant_consent_version: "2026-10-26",
      });
      await renderMore();

      expect(
        await within(screen.getByLabelText("Settings")).findByRole("button", {
          name: "Assistant, Off until you turn it on, Off",
        }),
      ).toBeOnTheScreen();
    });

    it("should open the Assistant settings screen inside this tab when pressed", async () => {
      const user = userEvent.setup();
      await renderMore();

      await user.press(await screen.findByRole("button", { name: /^Assistant/ }));

      expect(routerMock.push).toHaveBeenCalledWith("/more/assistant");
    });
  });

  describe("Reminders", () => {
    it("should be an enabled row in Settings, above About, with its icon and a chevron", async () => {
      await renderMore();

      const settings = within(screen.getByLabelText("Settings"));
      const row = settings.getByRole("button", { name: "Reminders" });

      expect(row).toBeEnabled();
      expect(drawingsIn(row)).toHaveLength(2);
      const rows = settings.getAllByRole("button");
      expect(rows.indexOf(row)).toBeLessThan(
        rows.indexOf(settings.getByRole("button", { name: "About" })),
      );
    });

    it("should open the Reminders screen when pressed", async () => {
      const user = userEvent.setup();
      await renderMore();

      await user.press(screen.getByRole("button", { name: "Reminders" }));

      expect(routerMock.push).toHaveBeenCalledWith("/reminders");
    });
  });

  describe("Workout suggestions", () => {
    it("should be a switch in Settings, on by default, after Reminders", async () => {
      await renderMore();

      const settings = within(screen.getByLabelText("Settings"));
      const toggle = await settings.findByRole("switch", { name: "Workout suggestions" });

      expect(toggle).toBeOnTheScreen();
      expect(toggle).toBeChecked();
      // The tree is in screen order, so the switch's name comes after Reminders' and before About's.
      const tree = JSON.stringify(screen.toJSON());
      expect(tree.indexOf("Workout suggestions")).toBeGreaterThan(tree.indexOf('"Reminders"'));
      expect(tree.indexOf("Workout suggestions")).toBeLessThan(tree.indexOf('"About"'));
    });

    it("should turn off and be stored when pressed", async () => {
      const user = userEvent.setup();
      await renderMore();

      await user.press(await screen.findByRole("switch", { name: "Workout suggestions" }));

      expect(screen.getByRole("switch", { name: "Workout suggestions" })).not.toBeChecked();
      expect(mockStorageItems.get(suggestionsPreferenceStorageKey)).toBe("false");
    });

    it("should show off when the device stored off", async () => {
      mockStorageItems.set(suggestionsPreferenceStorageKey, "false");
      await renderMore();

      await waitFor(() => {
        expect(screen.getByRole("switch", { name: "Workout suggestions" })).not.toBeChecked();
      });
    });
  });

  describe("About", () => {
    it("should be an enabled row in Settings, with its icon and a chevron because it goes somewhere", async () => {
      await renderMore();

      // The role query does not resolve a list, so the Settings list is found by its label.
      const row = within(screen.getByLabelText("Settings")).getByRole("button", {
        name: "About",
      });

      expect(row).toBeEnabled();
      expect(drawingsIn(row)).toHaveLength(2);
    });

    it("should open the About screen when pressed", async () => {
      const user = userEvent.setup();
      await renderMore();

      await user.press(screen.getByRole("button", { name: "About" }));

      expect(routerMock.push).toHaveBeenCalledWith("/about");
    });
  });

  describe("Request a feature", () => {
    it("should be the last row in Settings, after About, with its icon and a chevron", async () => {
      await renderMore();

      const settings = within(screen.getByLabelText("Settings"));
      const row = settings.getByRole("button", { name: /^Request a feature/ });

      expect(row).toBeEnabled();
      expect(drawingsIn(row)).toHaveLength(2);
      const rows = settings.getAllByRole("button");
      expect(rows[rows.length - 1]).toBe(row);
    });

    it("should open the Request a feature screen once when pressed", async () => {
      const user = userEvent.setup();
      await renderMore();

      await user.press(screen.getByRole("button", { name: /^Request a feature/ }));

      expect(routerMock.push).toHaveBeenCalledWith("/more/feature-request");
      expect(routerMock.push).toHaveBeenCalledTimes(1);
    });
  });

  describe("Export my data", () => {
    it("should be the first row in Account, above Sign out, with its icon and a chevron", async () => {
      await renderMore();

      const account = within(screen.getByLabelText("Account"));
      const row = account.getByRole("button", {
        name: "Export my data, A file with everything in your account",
      });

      expect(row).toBeEnabled();
      expect(drawingsIn(row)).toHaveLength(2);
      const rows = account.getAllByRole("button");
      expect(rows).toHaveLength(2);
      expect(rows[0]).toBe(row);
      expect(rows[1]).toHaveAccessibleName("Sign out");
    });

    it("should open the Export my data screen inside the More tab when pressed", async () => {
      const user = userEvent.setup();
      await renderMore();

      await user.press(screen.getByRole("button", { name: /^Export my data/ }));

      expect(routerMock.push).toHaveBeenCalledWith("/more/export");
    });

    it("should open the screen once on a double tap", async () => {
      const user = userEvent.setup();
      await renderMore();
      const row = screen.getByRole("button", { name: /^Export my data/ });

      await user.press(row);
      await user.press(row);

      expect(routerMock.push).toHaveBeenCalledTimes(1);
    });
  });

  describe("Sign out", () => {
    it("should draw its icon and no chevron, because it acts and goes nowhere", async () => {
      await renderMore();

      expect(drawingsIn(screen.getByRole("button", { name: "Sign out" }))).toHaveLength(1);
    });

    it("should sign the user out when pressed", async () => {
      const user = userEvent.setup();
      await renderMore();

      await user.press(screen.getByRole("button", { name: "Sign out" }));

      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalledTimes(1);
    });
  });
});
