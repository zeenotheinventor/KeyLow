import { describe, expect, it } from "vitest";

import {
  BARCODE_LOOKUP_FAILED,
  BARCODE_LOOKUP_PROGRESS,
  BARCODE_NOT_FOUND,
  BARCODE_NOT_RECOGNISED_TITLE,
  BARCODE_SCAN,
  CAMERA_PERMISSION,
  SCANNED_BARCODE_PROBLEMS,
  TYPED_BARCODE_PROBLEMS,
  describeBarcodeRateLimit,
} from "../../src/copy";

import type { BarcodeInvalidReason } from "../../src/foods";

const reasons: BarcodeInvalidReason[] = [
  "not_digits",
  "bad_length",
  "bad_check_digit",
  "not_upc_e",
];

describe("typed barcode problems", () => {
  it("should pin the sentences under the web barcode field", () => {
    expect(TYPED_BARCODE_PROBLEMS).toEqual({
      not_digits: "Use digits only",
      bad_length: "Use 8, 12, 13 or 14 digits",
      bad_check_digit: "The check digit is wrong, so check the digits and try again",
      not_upc_e: "That is not a valid 8 digit barcode",
    });
  });

  it("should have a sentence for every invalid reason", () => {
    for (const reason of reasons) {
      expect(TYPED_BARCODE_PROBLEMS[reason]).not.toBe("");
    }
  });
});

describe("scanned barcode problems", () => {
  it("should pin the drawn sentence for a wrong check digit", () => {
    expect(SCANNED_BARCODE_PROBLEMS.bad_check_digit).toBe(
      "The last digit does not match the others, so the barcode was misread. Hold the camera steady and scan again.",
    );
  });

  it("should say the barcode was misread and what to do, for every reason", () => {
    for (const reason of reasons) {
      expect(SCANNED_BARCODE_PROBLEMS[reason]).toContain("misread");
      expect(SCANNED_BARCODE_PROBLEMS[reason]).toMatch(/Hold the camera steady and scan again\.$/);
    }
  });

  it("should differ from the typed sentences, because a scan is a misread and typing is a mistake", () => {
    for (const reason of reasons) {
      expect(SCANNED_BARCODE_PROBLEMS[reason]).not.toBe(TYPED_BARCODE_PROBLEMS[reason]);
    }
  });

  it("should pin the other three sentences the brief lists", () => {
    expect(SCANNED_BARCODE_PROBLEMS.not_digits).toBe(
      "A food barcode is made of digits only, so this one was misread. Hold the camera steady and scan again.",
    );
    expect(SCANNED_BARCODE_PROBLEMS.bad_length).toBe(
      "That code is not the length of a food barcode, so it was misread. Hold the camera steady and scan again.",
    );
    expect(SCANNED_BARCODE_PROBLEMS.not_upc_e).toBe(
      "That short code is not a valid barcode, so it was misread. Hold the camera steady and scan again.",
    );
  });

  it("should pin the heading", () => {
    expect(BARCODE_NOT_RECOGNISED_TITLE).toBe("Barcode not recognised");
  });
});

describe("barcode lookup sentences", () => {
  it("should pin the not found sentences", () => {
    expect(BARCODE_NOT_FOUND).toEqual({
      title: "Not in Ki-Lo or Open Food Facts",
      scannedBody: "Create the food with this barcode and it will be found next time you scan it.",
      typedBody: "Create the food with this barcode and it will be found next time.",
      action: "Create food with this barcode",
    });
  });

  it("should pin the progress lines", () => {
    expect(BARCODE_LOOKUP_PROGRESS).toEqual({
      lookingUp: "Looking up the barcode",
      openingFood: "Opening the food",
    });
  });

  it("should pin the lookup failure", () => {
    expect(BARCODE_LOOKUP_FAILED).toEqual({
      title: "Lookup failed",
      body: "The barcode could not be looked up. Check your connection and try again.",
    });
  });
});

describe("describeBarcodeRateLimit", () => {
  it("should pin the drawn sentence", () => {
    expect(describeBarcodeRateLimit(30)).toBe(
      "Too many lookups just now. Try again in 30 seconds.",
    );
  });

  it("should say 1 second for one second", () => {
    expect(describeBarcodeRateLimit(1)).toBe("Too many lookups just now. Try again in 1 second.");
  });

  it("should say a moment when no time is known", () => {
    expect(describeBarcodeRateLimit(undefined)).toBe(
      "Too many lookups just now. Try again in a moment.",
    );
  });
});

describe("barcode scan screen", () => {
  it("should pin the header, the viewfinder and the lines around the camera", () => {
    expect(BARCODE_SCAN).toEqual({
      title: "Scan barcode",
      backLabel: "Back to search",
      closeLabel: "Close",
      viewfinderLabel: "Barcode viewfinder",
      hint: "Point the camera at a food barcode",
      barcodeReadLabel: "Barcode read",
      scanAgain: "Scan again",
    });
  });
});

describe("camera permission", () => {
  it("should pin the screen that asks for the camera", () => {
    expect(CAMERA_PERMISSION.ask).toEqual({
      title: "Camera access",
      body: "Ki-Lo uses the camera to scan food barcodes so you can look up a product without typing.",
      action: "Allow camera",
    });
  });

  it("should pin the screen for a camera that was refused for good", () => {
    expect(CAMERA_PERMISSION.denied).toEqual({
      title: "Camera access is off",
      body: "Ki-Lo cannot scan barcodes without the camera. Open the settings, allow camera access for Ki-Lo, then come back to scan.",
      action: "Open settings",
    });
  });
});
