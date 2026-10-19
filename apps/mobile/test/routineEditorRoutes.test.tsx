import { render, screen } from "@testing-library/react-native";
import { ExpoRoot, Slot } from "expo-router";
import { getMockContext } from "expo-router/testing-library";
import { createElement } from "react";
import { Text } from "react-native";

import TrainLayout from "../app/(tabs)/train/_layout";
import RoutinesRoute from "../app/(tabs)/train/routines";
import EditRoutineRoute from "../app/(tabs)/train/routines/[id]";
import ArchivedRoutinesRoute from "../app/(tabs)/train/routines/archived";
import NewRoutineRoute from "../app/(tabs)/train/routines/new";
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

// The screens the route files show are stood in for by a heading each, so what is tested is which route file
// the router picks for an address, and what that file hands the screen.
const mockHeading = (text: string) =>
  jest
    .requireActual<typeof import("react")>("react")
    .createElement(
      jest.requireActual<typeof import("react-native")>("react-native").Text,
      { role: "heading" },
      text,
    );
jest.mock("../components/RoutinesScreen", () => ({
  RoutinesScreen: () => mockHeading("Routines list"),
}));
jest.mock("../components/ArchivedRoutinesScreen", () => ({
  ArchivedRoutinesScreen: () => mockHeading("Archived routines"),
}));
jest.mock("../components/RoutineEditor", () => ({
  RoutineEditor: () => mockHeading("New routine editor"),
}));
jest.mock("../components/RoutineEditorScreen", () => ({
  RoutineEditorScreen: ({ id }: { id: string | undefined }) =>
    mockHeading(`Edit routine ${String(id)}`),
}));

const TabsStandIn = () => <Slot />;
const TrainStandIn = () => createElement(Text, { role: "heading" }, "Train screen");

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
        "(tabs)/train/index": TrainStandIn,
        "(tabs)/train/routines": RoutinesRoute,
        "(tabs)/train/routines/archived": ArchivedRoutinesRoute,
        "(tabs)/train/routines/new": NewRoutineRoute,
        "(tabs)/train/routines/[id]": EditRoutineRoute,
      })}
      location={location}
    />,
  );
}

describe("the routine editor's addresses beside the routines list and the archived list", () => {
  it("should still open the archived list at its address, and not read archived as a routine's id", async () => {
    await openAt(archivedRoutinesPath());

    expect(await screen.findByRole("heading", { name: "Archived routines" })).toBeOnTheScreen();
    expect(screen.queryByRole("heading", { name: /^Edit routine/ })).not.toBeOnTheScreen();
  });

  it("should still open the list at its address", async () => {
    await openAt(routinesPath());

    expect(await screen.findByRole("heading", { name: "Routines list" })).toBeOnTheScreen();
  });

  it("should open the new routine editor at new, and not read new as a routine's id", async () => {
    await openAt(`${routinesPath()}/new`);

    expect(await screen.findByRole("heading", { name: "New routine editor" })).toBeOnTheScreen();
    expect(screen.queryByRole("heading", { name: /^Edit routine/ })).not.toBeOnTheScreen();
  });

  it("should hand the id in the address to the edit screen", async () => {
    await openAt(`${routinesPath()}/55555555-5555-4555-8555-555555555555`);

    expect(
      await screen.findByRole("heading", {
        name: "Edit routine 55555555-5555-4555-8555-555555555555",
      }),
    ).toBeOnTheScreen();
  });
});
