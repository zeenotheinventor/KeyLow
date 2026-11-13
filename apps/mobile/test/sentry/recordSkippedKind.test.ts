import { addBreadcrumb } from "@sentry/react-native";

import { recordSkippedKind } from "../../lib/sentry/trail";

describe("recordSkippedKind", () => {
  it("should leave a breadcrumb with the name of the skipped event type and nothing else", () => {
    recordSkippedKind({ subject: "event", kind: "meal_plan_draft" });

    expect(addBreadcrumb).toHaveBeenLastCalledWith({
      category: "assistant.skipped",
      data: { subject: "event", kind: "meal_plan_draft" },
    });
  });

  it("should leave a breadcrumb with the name of the skipped card kind and nothing else", () => {
    recordSkippedKind({ subject: "card", kind: "plan_archived" });

    expect(addBreadcrumb).toHaveBeenLastCalledWith({
      category: "assistant.skipped",
      data: { subject: "card", kind: "plan_archived" },
    });
  });

  it("should leave a breadcrumb with the name of the skipped link screen and nothing else", () => {
    recordSkippedKind({ subject: "link", kind: "meal_plan" });

    expect(addBreadcrumb).toHaveBeenLastCalledWith({
      category: "assistant.skipped",
      data: { subject: "link", kind: "meal_plan" },
    });
  });
});
