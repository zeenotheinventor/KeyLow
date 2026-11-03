import { requestWidgetUpdate } from "react-native-android-widget";

import { createDefaultWidgetBridge } from "./defaultWidgetBridge";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));
jest.mock("react-native-android-widget", () => ({
  ...jest.requireActual<object>("react-native-android-widget"),
  requestWidgetUpdate: jest.fn(() => Promise.resolve()),
}));

describe("the default widget bridge", () => {
  beforeEach(() => jest.mocked(requestWidgetUpdate).mockClear());

  it("should redraw the six widgets on Android", async () => {
    await createDefaultWidgetBridge("android").requestRedraw();

    expect(requestWidgetUpdate).toHaveBeenCalledTimes(6);
  });

  it("should redraw nothing anywhere else", async () => {
    await createDefaultWidgetBridge("ios").requestRedraw();

    expect(requestWidgetUpdate).not.toHaveBeenCalled();
  });
});
