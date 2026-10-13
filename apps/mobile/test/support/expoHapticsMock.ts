// Every test gets expo-haptics with its real constants and no native calls, so a component test that
// presses something with feedback does not reach the native module. A test asserts on the calls by
// importing the functions from "expo-haptics" and wrapping them with jest.mocked.
jest.mock("expo-haptics", () => ({
  ...jest.requireActual<typeof import("expo-haptics")>("expo-haptics"),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
}));
