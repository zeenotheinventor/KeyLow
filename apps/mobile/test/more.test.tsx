import { KeyLowProvider } from "@keylow/api-client";
import { render, screen, userEvent, within } from "@testing-library/react-native";
import { Text } from "react-native";

import MoreRoute from "../app/(tabs)/more";
import { ThemeProvider, useTheme } from "../lib/theme";
import { deviceScheme } from "./support/deviceScheme";
import {
  createDiaryQueryClient,
  diaryBackend,
  diaryClient,
  noTargets,
  requestsTo,
  resetDiaryBackend,
} from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
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
      <KeyLowProvider client={diaryClient} queryClient={createDiaryQueryClient()}>
        <MoreRoute />
        <ThemeProbe />
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
    mockStorageItems.clear();
    mockSetItem.mockClear();
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

    it("should have no Recipes row, because Recipes is a tab", async () => {
      await renderMore();

      expect(screen.queryByText("Recipes")).not.toBeOnTheScreen();
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

      expect(within(screen.getByLabelText("Nutrition")).getByRole("button")).toBe(row);
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

  describe("Weight", () => {
    it("should be a disabled row marked Coming soon", async () => {
      await renderMore();

      const row = screen.getByLabelText("Weight, Coming soon");

      expect(row).toBeDisabled();
    });

    it("should not be offered as a button, and go nowhere", async () => {
      await renderMore();

      expect(screen.queryByRole("button", { name: /^Weight/ })).not.toBeOnTheScreen();
      expect(routerMock.push).not.toHaveBeenCalled();
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
