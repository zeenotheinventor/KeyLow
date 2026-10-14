import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeFood } from "./support";

import type { UseFoodByBarcodeOptions, UseFoodByBarcodeReturn } from "@keylow/api-client";

import { BarcodeLookup } from "@/components/foods/BarcodeLookup";

const { useFoodByBarcode, push, router } = vi.hoisted(() => {
  const push = vi.fn<(href: string) => void>();
  // One router object for every render, as the real router is, so only the attempt re-opens a food.
  return {
    useFoodByBarcode:
      vi.fn<(code: string, options?: UseFoodByBarcodeOptions) => UseFoodByBarcodeReturn>(),
    push,
    router: { push },
  };
});

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useFoodByBarcode,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

const VALID_EAN_13 = "5000159484695";
const BAD_CHECK_DIGIT = "5000159484696";
// A UPC-A code, which is stored as the EAN-13 with a leading zero.
const UPC_A = "036000291452";
const UPC_A_AS_STORED = "0036000291452";

const idle: UseFoodByBarcodeReturn = { result: undefined, isLoading: false, error: null };

function renderPanel(onClose = vi.fn<() => void>()) {
  render(<BarcodeLookup onClose={onClose} />);
  return onClose;
}

function lookUp(digits: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Barcode number" }), {
    target: { value: digits },
  });
  fireEvent.click(screen.getByRole("button", { name: "Look up" }));
}

describe("BarcodeLookup", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useFoodByBarcode.mockReturnValue(idle);
  });

  afterEach(() => {
    cleanup();
  });

  describe("the open panel", () => {
    it("should be a region with a labelled field for the digits, a Look up button and a close button", () => {
      renderPanel();

      expect(screen.getByRole("region", { name: "Barcode lookup" })).toBeTruthy();
      expect(
        screen.getByRole("textbox", { name: "Barcode number" }).getAttribute("placeholder"),
      ).toBe("e.g. 5000159484695");
      expect(screen.getByRole("button", { name: "Look up" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Close barcode lookup" })).toBeTruthy();
    });

    it("should put the cursor in the field", () => {
      renderPanel();

      expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Barcode number" }));
    });

    it("should ask the page to close it from the close button", () => {
      const onClose = renderPanel();

      fireEvent.click(screen.getByRole("button", { name: "Close barcode lookup" }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should look nothing up before the form is submitted", () => {
      renderPanel();

      fireEvent.change(screen.getByRole("textbox", { name: "Barcode number" }), {
        target: { value: VALID_EAN_13 },
      });

      expect(useFoodByBarcode).toHaveBeenLastCalledWith("", { enabled: false });
      expect(screen.queryByRole("status")).toBeNull();
    });
  });

  describe("a code that is not a barcode", () => {
    it.each([
      ["50001x9484695", "Use digits only"],
      ["", "Use 8, 12, 13 or 14 digits"],
      ["12345", "Use 8, 12, 13 or 14 digits"],
      [BAD_CHECK_DIGIT, "The check digit is wrong, so check the digits and try again"],
    ])("should explain %j beside the field and look nothing up", (digits, message) => {
      renderPanel();

      lookUp(digits);

      expect(
        screen.getByRole("textbox", { name: "Barcode number", description: message }),
      ).toBeTruthy();
      expect(screen.getByRole("alert").textContent).toBe(message);
      expect(useFoodByBarcode).toHaveBeenLastCalledWith("", { enabled: false });
      expect(push).not.toHaveBeenCalled();
    });

    it("should mark the field as invalid", () => {
      renderPanel();

      lookUp(BAD_CHECK_DIGIT);

      expect(
        screen.getByRole("textbox", { name: "Barcode number" }).getAttribute("aria-invalid"),
      ).toBe("true");
    });

    it("should drop the result of an earlier valid code when a later code is not valid", () => {
      useFoodByBarcode.mockReturnValue({
        result: { status: "not_found", code: VALID_EAN_13 },
        isLoading: false,
        error: null,
      });
      renderPanel();
      lookUp(VALID_EAN_13);
      expect(screen.getByText("Not in Ki-Lo or Open Food Facts")).toBeTruthy();

      lookUp(BAD_CHECK_DIGIT);

      expect(screen.queryByText("Not in Ki-Lo or Open Food Facts")).toBeNull();
      expect(screen.getByText(/The check digit is wrong/)).toBeTruthy();
    });

    it("should clear the explanation once a valid code is submitted", () => {
      renderPanel();
      lookUp(BAD_CHECK_DIGIT);

      lookUp(VALID_EAN_13);

      expect(screen.queryByText(/The check digit is wrong/)).toBeNull();
      expect(
        screen.getByRole("textbox", { name: "Barcode number" }).getAttribute("aria-invalid"),
      ).toBe("false");
    });
  });

  describe("a valid code", () => {
    it("should look up the canonical form of the code", () => {
      renderPanel();

      lookUp(UPC_A);

      expect(useFoodByBarcode).toHaveBeenLastCalledWith(UPC_A_AS_STORED, { enabled: true });
    });

    it("should accept digits grouped with spaces", () => {
      renderPanel();

      lookUp("5000 1594 84695");

      expect(useFoodByBarcode).toHaveBeenLastCalledWith(VALID_EAN_13, { enabled: true });
    });

    it("should say it is looking, and hold the button busy, while the lookup is under way", () => {
      useFoodByBarcode.mockReturnValue({ result: undefined, isLoading: true, error: null });
      renderPanel();

      lookUp(VALID_EAN_13);

      expect(screen.getByText("Looking up the barcode").getAttribute("role")).toBe("status");
      const button = screen.getByRole("button", { name: "Looking up" });
      expect(button.getAttribute("aria-busy")).toBe("true");
      expect(button).toHaveProperty("disabled", true);
    });

    it("should say it is opening the food, and open it, when it is found", () => {
      useFoodByBarcode.mockReturnValue({
        result: { status: "found", food: makeFood({ id: "found-food" }) },
        isLoading: false,
        error: null,
      });
      renderPanel();

      lookUp(VALID_EAN_13);

      expect(screen.getByText("Opening the food").getAttribute("role")).toBe("status");
      expect(push).toHaveBeenCalledTimes(1);
      expect(push).toHaveBeenCalledWith("/foods/found-food");
    });

    it("should open nothing before a code is submitted, whatever the lookup holds", () => {
      useFoodByBarcode.mockReturnValue({
        result: { status: "found", food: makeFood({ id: "found-food" }) },
        isLoading: false,
        error: null,
      });
      renderPanel();

      expect(push).not.toHaveBeenCalled();
      expect(screen.queryByText("Opening the food")).toBeNull();
    });

    it("should open the food again when the same code is looked up a second time", () => {
      useFoodByBarcode.mockReturnValue({
        result: { status: "found", food: makeFood({ id: "found-food" }) },
        isLoading: false,
        error: null,
      });
      renderPanel();

      lookUp(VALID_EAN_13);
      lookUp(VALID_EAN_13);

      expect(push).toHaveBeenCalledTimes(2);
    });

    it("should say the code is not in Ki-Lo or Open Food Facts and offer to create a food with it", () => {
      useFoodByBarcode.mockReturnValue({
        result: { status: "not_found", code: UPC_A_AS_STORED },
        isLoading: false,
        error: null,
      });
      renderPanel();

      lookUp(UPC_A);

      expect(screen.getByText("Not in Ki-Lo or Open Food Facts")).toBeTruthy();
      expect(
        screen.getByText("Create the food with this barcode and it will be found next time."),
      ).toBeTruthy();
      expect(
        screen.getByRole("link", { name: "Create food with this barcode" }).getAttribute("href"),
      ).toBe(`/foods/new?barcode=${UPC_A_AS_STORED}`);
      expect(push).not.toHaveBeenCalled();
    });

    it("should say the lookup failed in an alert, without the raw text, and offer no food to create", () => {
      useFoodByBarcode.mockReturnValue({
        result: undefined,
        isLoading: false,
        error: { kind: "failed", debugMessage: "Could not reach the server" },
      });
      renderPanel();

      lookUp(VALID_EAN_13);

      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain("Lookup failed");
      expect(alert.textContent).toContain(
        "The barcode could not be looked up. Check your connection and try again.",
      );
      expect(alert.textContent).not.toContain("Could not reach the server");
      expect(screen.queryByRole("link", { name: "Create food with this barcode" })).toBeNull();
    });

    it("should say Open Food Facts is busy, and when to try again, when it is rate limited", () => {
      useFoodByBarcode.mockReturnValue({
        result: undefined,
        isLoading: false,
        error: { kind: "rate_limited", retryAfterSeconds: 30, debugMessage: "Slow down" },
      });
      renderPanel();

      lookUp(VALID_EAN_13);

      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain("Open Food Facts is busy");
      expect(alert.textContent).toContain("Too many lookups just now.");
      expect(alert.textContent).toContain("Try again in 30 seconds.");
    });

    it("should say to try again in a moment when no delay is known", () => {
      useFoodByBarcode.mockReturnValue({
        result: undefined,
        isLoading: false,
        error: { kind: "rate_limited", debugMessage: "Slow down" },
      });
      renderPanel();

      lookUp(VALID_EAN_13);

      expect(screen.getByRole("alert").textContent).toContain("Try again in a moment.");
    });

    it("should not claim a rate limit when Open Food Facts answered with another error kind", () => {
      useFoodByBarcode.mockReturnValue({
        result: undefined,
        isLoading: false,
        error: {
          kind: "upstream_error",
          debugMessage: "Open Food Facts is unavailable",
        },
      });
      renderPanel();

      lookUp(VALID_EAN_13);

      const alert = screen.getByRole("alert");
      expect(alert.textContent).not.toContain("busy");
      expect(alert.textContent).not.toContain("unavailable");
      expect(alert.textContent).toContain("Lookup failed");
    });
  });
});
