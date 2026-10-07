import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeFood } from "./support";

import type { UseFoodByBarcodeReturn } from "@keylow/api-client";

import { BarcodeLookup } from "@/components/foods/BarcodeLookup";

const { useFoodByBarcode, push, router } = vi.hoisted(() => {
  const push = vi.fn<(href: string) => void>();
  // One router object for every render, as the real router is, so only the key remounts the result.
  return {
    useFoodByBarcode: vi.fn<(code: string) => UseFoodByBarcodeReturn>(),
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

function lookUp(digits: string) {
  fireEvent.change(screen.getByLabelText("Barcode number"), { target: { value: digits } });
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

  it("should offer a labelled field for the digits and a Look up button under a Barcode heading", () => {
    render(<BarcodeLookup />);

    expect(screen.getByRole("heading", { name: "Barcode" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Barcode number" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Look up" })).toBeTruthy();
  });

  it("should look nothing up before the form is submitted", () => {
    render(<BarcodeLookup />);

    fireEvent.change(screen.getByLabelText("Barcode number"), { target: { value: VALID_EAN_13 } });

    expect(useFoodByBarcode).not.toHaveBeenCalled();
  });

  describe("a code that is not a barcode", () => {
    it("should explain a wrong check digit beside the field and call nothing", () => {
      render(<BarcodeLookup />);

      lookUp(BAD_CHECK_DIGIT);

      expect(
        screen.getByRole("textbox", {
          name: "Barcode number",
          description: "The check digit is wrong, so check the digits and try again",
        }),
      ).toBeTruthy();
      expect(useFoodByBarcode).not.toHaveBeenCalled();
      expect(push).not.toHaveBeenCalled();
    });

    it("should say when the code has letters in it", () => {
      render(<BarcodeLookup />);

      lookUp("50001x9484695");

      expect(screen.getByText("Use digits only")).toBeTruthy();
      expect(useFoodByBarcode).not.toHaveBeenCalled();
    });

    it("should say when the code is the wrong length, including when it is empty", () => {
      render(<BarcodeLookup />);

      lookUp("");

      expect(screen.getByText("Use 8, 12, 13 or 14 digits")).toBeTruthy();
      expect(useFoodByBarcode).not.toHaveBeenCalled();
    });

    it("should drop the result of an earlier valid code when a later code is not valid", () => {
      useFoodByBarcode.mockReturnValue({
        result: { status: "not_found", code: VALID_EAN_13 },
        isLoading: false,
        error: null,
      });
      render(<BarcodeLookup />);
      lookUp(VALID_EAN_13);
      expect(screen.getByText("Not in the database")).toBeTruthy();

      lookUp(BAD_CHECK_DIGIT);

      expect(screen.queryByText("Not in the database")).toBeNull();
      expect(screen.getByText(/The check digit is wrong/)).toBeTruthy();
    });

    it("should clear the explanation once a valid code is submitted", () => {
      render(<BarcodeLookup />);
      lookUp(BAD_CHECK_DIGIT);

      lookUp(VALID_EAN_13);

      expect(screen.queryByText(/The check digit is wrong/)).toBeNull();
    });
  });

  describe("a valid code", () => {
    it("should look up the canonical form of the code", () => {
      render(<BarcodeLookup />);

      lookUp(UPC_A);

      expect(useFoodByBarcode).toHaveBeenCalledWith(UPC_A_AS_STORED);
    });

    it("should accept digits grouped with spaces", () => {
      render(<BarcodeLookup />);

      lookUp("5000 1594 84695");

      expect(useFoodByBarcode).toHaveBeenCalledWith(VALID_EAN_13);
    });

    it("should say it is looking while the lookup is under way", () => {
      useFoodByBarcode.mockReturnValue({ result: undefined, isLoading: true, error: null });
      render(<BarcodeLookup />);

      lookUp(VALID_EAN_13);

      expect(screen.getByRole("status").textContent).toContain("Looking up the barcode");
    });

    it("should open the food when it is found", () => {
      const food = makeFood({ id: "found-food" });
      useFoodByBarcode.mockReturnValue({
        result: { status: "found", food },
        isLoading: false,
        error: null,
      });
      render(<BarcodeLookup />);

      lookUp(VALID_EAN_13);

      expect(push).toHaveBeenCalledTimes(1);
      expect(push).toHaveBeenCalledWith("/foods/found-food");
    });

    it("should open the food again when the same code is looked up a second time", () => {
      useFoodByBarcode.mockReturnValue({
        result: { status: "found", food: makeFood({ id: "found-food" }) },
        isLoading: false,
        error: null,
      });
      render(<BarcodeLookup />);

      lookUp(VALID_EAN_13);
      lookUp(VALID_EAN_13);

      expect(push).toHaveBeenCalledTimes(2);
    });

    it("should say the code is not in the database and offer to create a food with it", () => {
      useFoodByBarcode.mockReturnValue({
        result: { status: "not_found", code: UPC_A_AS_STORED },
        isLoading: false,
        error: null,
      });
      render(<BarcodeLookup />);

      lookUp(UPC_A);

      expect(screen.getByText("Not in the database")).toBeTruthy();
      expect(
        screen.getByRole("link", { name: "Create food with this barcode" }).getAttribute("href"),
      ).toBe(`/foods/new?barcode=${UPC_A_AS_STORED}`);
      expect(push).not.toHaveBeenCalled();
    });

    it("should say when Open Food Facts is rate limited and when to try again", () => {
      useFoodByBarcode.mockReturnValue({
        result: undefined,
        isLoading: false,
        error: { kind: "rate_limited", retryAfterSeconds: 30 },
      });
      render(<BarcodeLookup />);

      lookUp(VALID_EAN_13);

      expect(screen.getByRole("alert").textContent).toContain("Try again in 30 seconds");
    });

    it("should say when to try again in general terms if no delay is known", () => {
      useFoodByBarcode.mockReturnValue({
        result: undefined,
        isLoading: false,
        error: { kind: "rate_limited" },
      });
      render(<BarcodeLookup />);

      lookUp(VALID_EAN_13);

      expect(screen.getByRole("alert").textContent).toContain("Try again in a little while");
    });

    it("should show the reason in an alert when the lookup failed", () => {
      useFoodByBarcode.mockReturnValue({
        result: undefined,
        isLoading: false,
        error: { kind: "failed", message: "Could not reach the server" },
      });
      render(<BarcodeLookup />);

      lookUp(VALID_EAN_13);

      expect(screen.getByRole("alert").textContent).toContain("Could not reach the server");
      expect(screen.queryByRole("link", { name: "Create food with this barcode" })).toBeNull();
    });
  });
});
