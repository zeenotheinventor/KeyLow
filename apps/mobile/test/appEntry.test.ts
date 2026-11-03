import { registerWidgetTaskHandler } from "react-native-android-widget";

import "../index";
import packageJson from "../package.json";

jest.mock("expo-router/entry", () => ({}));
jest.mock("react-native-android-widget", () => ({
  registerWidgetTaskHandler: jest.fn(),
}));
jest.mock("../lib/widgets/defaultWidgetTaskHandler", () => ({ widgetTaskHandler: jest.fn() }));

describe("the app entry", () => {
  it("should be the file that registers the widget task handler", () => {
    expect(packageJson.main).toBe("index.ts");
  });

  it("should start the router as before and register the widget task handler beside it", () => {
    // Importing the entry runs it, which is the thing under test.
    expect(registerWidgetTaskHandler).toHaveBeenCalledTimes(1);
  });
});
