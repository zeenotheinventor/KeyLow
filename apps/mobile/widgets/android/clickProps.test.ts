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

  it("should turn Log again into a named click carrying only the entry's id", () => {
    expect(clickPropsFor({ type: "log_again", entryId: "entry-id" })).toEqual({
      clickAction: "LOG_AGAIN",
      clickActionData: { entryId: "entry-id" },
    });
  });

  it("should turn Log set into a named click carrying only ids and the set position", () => {
    expect(
      clickPropsFor({
        type: "log_set",
        sessionId: "session-id",
        exerciseId: "exercise-id",
        setNumber: 3,
      }),
    ).toEqual({
      clickAction: "LOG_SET",
      clickActionData: { sessionId: "session-id", exerciseId: "exercise-id", setNumber: 3 },
    });
  });

  it("should turn Undo into a named click with no data, because the handler reads its stored record", () => {
    expect(clickPropsFor({ type: "undo", action: "log_set", rowId: "row-id" })).toEqual({
      clickAction: "UNDO",
      clickActionData: {},
    });
  });

  it("should carry no name, load, amount or other health data in any click", () => {
    const clicks = [
      clickPropsFor({ type: "log_again", entryId: "e" }),
      clickPropsFor({ type: "log_set", sessionId: "s", exerciseId: "x", setNumber: 1 }),
      clickPropsFor({ type: "undo", action: "log_again", rowId: "r" }),
    ];

    for (const click of clicks) {
      for (const [key, value] of Object.entries(click.clickActionData ?? {})) {
        expect(["entryId", "sessionId", "exerciseId", "setNumber"]).toContain(key);
        expect(["string", "number"]).toContain(typeof value);
      }
    }
  });
});
