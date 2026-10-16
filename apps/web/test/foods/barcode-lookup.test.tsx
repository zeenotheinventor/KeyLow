import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeFood, makePortion } from "./support";
import { foodEntry } from "../diary/support";

import type {
  LogFoodInput,
  LogEntry,
  UseFoodByBarcodeOptions,
  UseFoodByBarcodeReturn,
} from "@keylow/api-client";

import { BarcodeLookup } from "@/components/foods/BarcodeLookup";
import { ToastProvider } from "@/components/ui/Toast";
import { FoodLogActionsProvider } from "@/lib/foodLogActions";

const { useFoodByBarcode, push, router, logFood, foods } = vi.hoisted(() => {
  const push = vi.fn<(href: string) => void>();
  // One router object for every render, as the real router is, so only the attempt re-opens a food.
  return {
    useFoodByBarcode:
      vi.fn<(code: string, options?: UseFoodByBarcodeOptions) => UseFoodByBarcodeReturn>(),
    push,
    router: { push },
    logFood: { mutateAsync: vi.fn<(input: LogFoodInput) => Promise<LogEntry>>() },
    foods: new Map<string, unknown>(),
  };
});

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useFoodByBarcode,
  useProfileTimeZone: () => ({ data: "UTC" }),
  useFoodWithPortions: (id: string) => {
    const found = foods.get(id);
    return found === undefined ? { status: "notFound" } : { status: "ready", ...found };
  },
  useLogFood: () => logFood,
  useDeleteEntry: () => ({ mutateAsync: vi.fn() }),
  useSupabase: () => ({}),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/foods",
}));

const VALID_EAN_13 = "5000159484695";
const BAD_CHECK_DIGIT = "5000159484696";
// A UPC-A code, which is stored as the EAN-13 with a leading zero.
const UPC_A = "036000291452";
const UPC_A_AS_STORED = "0036000291452";

const idle: UseFoodByBarcodeReturn = { result: undefined, isLoading: false, error: null };

// 12:40 on Thursday 15 October 2026 in UTC, so "now" is 12:40.
const NOW = new Date("2026-10-15T12:40:30Z");

function renderPanel(onClose = vi.fn<() => void>(), day?: string) {
  render(
    <ToastProvider>
      <FoodLogActionsProvider>
        <BarcodeLookup onClose={onClose} {...(day === undefined ? {} : { day })} />
      </FoodLogActionsProvider>
    </ToastProvider>,
  );
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
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    useFoodByBarcode.mockReturnValue(idle);
    foods.clear();
    logFood.mutateAsync.mockImplementation((input) =>
      Promise.resolve(
        foodEntry({
          date: input.localDate,
          time: "12:40",
          name: input.food.name,
          quantity: input.quantity,
          unit: "portion",
          kcal: 1,
          protein: 1,
          fat: 1,
          carbs: 1,
        }),
      ),
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
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
      expect(screen.queryByText("Looking up the barcode")).toBeNull();
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

    describe("a food that is found", () => {
      const oatCakes = makeFood({ id: "found-food", name: "Oat cakes" });
      const handful = makePortion({
        id: "found-portion",
        food_id: "found-food",
        label: "1 handful",
        grams: 30,
        is_default: true,
      });

      beforeEach(() => {
        foods.set("found-food", { food: oatCakes, portions: [handful] });
        useFoodByBarcode.mockReturnValue({
          result: { status: "found", food: oatCakes },
          isLoading: false,
          error: null,
        });
      });

      it("should say it is opening the food", () => {
        renderPanel();

        lookUp(VALID_EAN_13);

        expect(screen.getByText("Opening the food").getAttribute("role")).toBe("status");
      });

      it("should open the Add food dialog on that food's portion step, and not the food's page", () => {
        renderPanel();

        lookUp(VALID_EAN_13);

        expect(screen.getByRole("dialog", { name: "Add food" })).toBeTruthy();
        expect(screen.getByRole("radio", { name: "1 handful", checked: true })).toBeTruthy();
        expect(screen.getByText("Now")).toBeTruthy();
        expect(screen.queryByRole("searchbox")).toBeNull();
        expect(push).not.toHaveBeenCalled();
      });

      it("should log the default portion now, today, with one press on Add after the lookup", async () => {
        renderPanel();
        lookUp(VALID_EAN_13);

        fireEvent.click(screen.getByRole("button", { name: "Add" }));

        await waitFor(() => {
          expect(screen.queryByRole("dialog")).toBeNull();
        });
        expect(logFood.mutateAsync).toHaveBeenCalledExactlyOnceWith({
          food: oatCakes,
          quantity: 1,
          unit: "portion",
          portion: handful,
          loggedAt: "2026-10-15T12:40:30.000Z",
          localDate: "2026-10-15",
        });
        expect(await screen.findByText("Added")).toBeTruthy();
      });

      it("should log on the day it was given, at the current clock time", async () => {
        renderPanel(undefined, "2026-10-12");
        lookUp(VALID_EAN_13);

        fireEvent.click(screen.getByRole("button", { name: "Add" }));

        await waitFor(() => {
          expect(logFood.mutateAsync).toHaveBeenCalledOnce();
        });
        expect(logFood.mutateAsync.mock.calls[0]?.[0].localDate).toBe("2026-10-12");
        expect(logFood.mutateAsync.mock.calls[0]?.[0].loggedAt).toBe("2026-10-12T12:40:00.000Z");
      });

      it("should leave the panel where it was when the dialog is closed", () => {
        renderPanel();
        lookUp(VALID_EAN_13);

        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

        expect(screen.queryByRole("dialog")).toBeNull();
        expect(screen.getByRole("region", { name: "Barcode lookup" })).toBeTruthy();
      });

      it("should open nothing before a code is submitted, whatever the lookup holds", () => {
        renderPanel();

        expect(screen.queryByRole("dialog")).toBeNull();
        expect(screen.queryByText("Opening the food")).toBeNull();
      });

      it("should open the dialog again when the same code is looked up a second time", () => {
        renderPanel();
        lookUp(VALID_EAN_13);
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

        lookUp(VALID_EAN_13);

        expect(screen.getByRole("dialog", { name: "Add food" })).toBeTruthy();
      });
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

    it("should carry the day in the link to create the food, so the new food is added to it", () => {
      useFoodByBarcode.mockReturnValue({
        result: { status: "not_found", code: VALID_EAN_13 },
        isLoading: false,
        error: null,
      });
      renderPanel(undefined, "2026-10-12");

      lookUp(VALID_EAN_13);

      expect(
        screen.getByRole("link", { name: "Create food with this barcode" }).getAttribute("href"),
      ).toBe(`/foods/new?barcode=${VALID_EAN_13}&day=2026-10-12`);
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
