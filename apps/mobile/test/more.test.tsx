import { KeyLowProvider } from "@keylow/api-client";
import { act, render, screen, userEvent, within } from "@testing-library/react-native";
import { Text } from "react-native";

import MoreRoute from "../app/(tabs)/more";
import { resetBodyFigureForTests } from "../lib/bodyFigure/testing";
import { useBodyMapRenderer } from "../lib/bodyMapRenderer";
import { resetBodyMapRendererForTests } from "../lib/bodyMapRenderer/testing";
import { ThemeProvider, useTheme } from "../lib/theme";
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
      </KeyLowProvider>
    </ThemeProvider>,
  );
  await screen.findByRole("heading", { name: "More" });
}

describe("the More screen", () => {
  beforeEach(() => {
    resetRouterMock();
    resetSupabaseMock();
    resetDiaryBackend();
    resetProgramBackend();
    mockStorageItems.clear();
    mockSetItem.mockClear();
    resetBodyMapRendererForTests();
    resetBodyFigureForTests();
    deviceScheme.current = "light";
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
