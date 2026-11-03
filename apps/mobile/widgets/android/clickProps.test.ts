import { clickPropsFor, widgetUri } from "./clickProps";

describe("the widget tap", () => {
  it("should open a path of the app through the keylow scheme without its leading slash", () => {
    expect(widgetUri("/diary")).toBe("keylow://diary");
    expect(widgetUri("/foods/scan")).toBe("keylow://foods/scan");
  });

  it("should keep a query on the link", () => {
    expect(widgetUri("/session?start=planned&nonce=abc")).toBe(
      "keylow://session?start=planned&nonce=abc",
    );
  });

  it("should open the app's root with the bare scheme", () => {
    expect(widgetUri("/")).toBe("keylow://");
  });

  it("should turn an open action into the library's OPEN_URI click", () => {
    expect(clickPropsFor({ type: "open", path: "/week" })).toEqual({
      clickAction: "OPEN_URI",
      clickActionData: { uri: "keylow://week" },
    });
  });

  it("should leave an action that runs a write unwired until the one-tap widgets", () => {
    expect(clickPropsFor({ type: "log_again", entryId: "entry" })).toEqual({});
  });
});
