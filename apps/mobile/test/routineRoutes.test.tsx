import { existsSync } from "node:fs";
import { join } from "node:path";

import { render, screen } from "@testing-library/react-native";
import { ExpoRoot, Slot } from "expo-router";
import { getMockContext } from "expo-router/testing-library";
import { Text } from "react-native";

import TrainLayout from "../app/(tabs)/train/_layout";
import { archivedRoutinesPath, routinesPath } from "../lib/routineRoutes";
import { ThemeProvider } from "../lib/theme";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

// The addresses the routines screens answer and send to must be files under app/, or the control that leads
// there opens the not-found screen.
const appDirectory = join(__dirname, "..", "app");

describe("the routines addresses and the screens under app/", () => {
  it("should keep the routines inside the Train tab, at the addresses the tickets that link to them use", () => {
    expect(routinesPath()).toBe("/train/routines");
    expect(archivedRoutinesPath()).toBe("/train/routines/archived");
  });

  it.each([
    ["the routines list", "(tabs)/train/routines.tsx"],
    ["the archived routines", "(tabs)/train/routines/archived.tsx"],
  ])("should have a route file for %s", (_name, file) => {
    expect(existsSync(join(appDirectory, file))).toBe(true);
  });
});

const standIn = (text: string) =>
  function StandIn() {
    return <Text role="heading">{text}</Text>;
  };

function TabsStandIn() {
  return <Slot />;
}

function Providers() {
  return (
    <ThemeProvider fixedPreference="dark">
      <Slot />
    </ThemeProvider>
  );
}

async function openAt(location: string) {
  await render(
    <ExpoRoot
      context={getMockContext({
        _layout: Providers,
        "(tabs)/_layout": TabsStandIn,
        "(tabs)/train/_layout": TrainLayout,
        "(tabs)/train/index": standIn("Train screen"),
        "(tabs)/train/routines": standIn("Routines screen"),
        "(tabs)/train/routines/archived": standIn("Archived screen"),
      })}
      location={location}
    />,
  );
}

describe("the router with a routines file beside a routines folder", () => {
  it("should open the list at its address", async () => {
    await openAt(routinesPath());

    expect(await screen.findByRole("heading", { name: "Routines screen" })).toBeOnTheScreen();
  });

  it("should open the archived routines at theirs", async () => {
    await openAt(archivedRoutinesPath());

    expect(await screen.findByRole("heading", { name: "Archived screen" })).toBeOnTheScreen();
  });
});
