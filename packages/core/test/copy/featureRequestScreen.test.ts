import { describe, expect, it } from "vitest";

import { collectStrings } from "./collectStrings";
import { FEATURE_REQUEST_SCREEN, describeFeatureRequestLength } from "../../src/copy";

describe("FEATURE_REQUEST_SCREEN", () => {
  it("should pin the words of the Request a feature screen", () => {
    expect(FEATURE_REQUEST_SCREEN).toEqual({
      title: "Request a feature",
      back: "Back to More",
      explainer: "Your request goes to the Ki-Lo team, and every one is read.",
      fieldLabel: "Your feature request",
      placeholder: "What should Ki-Lo do next?",
      send: "Send",
      tooLong: "That is over 1,000 characters. Shorten it to send.",
      sentToast: "Thanks, your request has been sent",
      failed: {
        title: "Your request was not sent",
        body: "Check your connection and try again. What you typed is still here.",
      },
      dailyLimit: {
        title: "Daily limit reached",
        body: "You have sent the most requests Ki-Lo takes in a day. Try again tomorrow. What you typed is still here.",
      },
    });
  });

  it("should use no em dash, double hyphen or semicolon", () => {
    for (const sentence of collectStrings(FEATURE_REQUEST_SCREEN)) {
      expect(sentence).not.toMatch(/—|--|;/);
    }
  });
});

describe("describeFeatureRequestLength", () => {
  it("should count the trimmed text against the most a request holds", () => {
    expect(describeFeatureRequestLength("  Water tracking  ")).toBe("14 / 1,000");
  });
});
