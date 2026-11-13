import { ASSISTANT_DESCRIBE } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { noPlateHooks } from "./noPlateHooks";
import { noFavouriteHooks } from "../favourites/noFavouriteHooks";
import { makeSearchHit } from "../foods/support";

import type { FoodSearchResult } from "@keylow/api-client";
import type { DescribeInLogOpening } from "@keylow/core";

import { AddFoodDialog } from "@/components/diary/AddFoodDialog";
import { ToastProvider } from "@/components/ui/Toast";
import { FoodLogActionsProvider, useFoodLogActions } from "@/lib/foodLogActions";

const rice = makeSearchHit({
  id: "11111111-1111-4111-8111-222222222222",
  name: "Basmati rice, boiled",
  source: "cofid",
  kcal: 120,
});

const api = vi.hoisted((): { local: FoodSearchResult["local"] } => ({ local: [] }));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  ...noFavouriteHooks,
  ...noPlateHooks,
  useRefreshOutdatedOffFood: () => undefined,
  useProfileTimeZone: () => ({ data: "UTC" }),
  useRecentFoods: () => ({ data: [], isError: false, fetchStatus: "idle" }),
  useFoodSearch: (query: string): FoodSearchResult => ({
    local: query.trim().length >= 2 ? api.local : [],
    off: [],
    isLoadingLocal: false,
    isLoadingOff: false,
    isDebouncing: false,
    offError: null,
    localError: null,
  }),
  useRecipeSearch: () => ({ recipes: [], isLoading: false, isDebouncing: false, error: null }),
  useFoodByBarcode: () => ({ result: undefined, isLoading: false, error: null }),
  useFoodWithPortions: () => ({ status: "notFound" }),
  useSupabase: () => ({}),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/diary",
  useSearchParams: () => new URLSearchParams(),
}));

type Request = { date?: string; time?: string };

function renderDialog(request: Request, onDescribe?: (opening: DescribeInLogOpening) => void) {
  render(
    <ToastProvider>
      <FoodLogActionsProvider>
        <AddFoodDialog
          request={request}
          opener={null}
          onClose={vi.fn<() => void>()}
          {...(onDescribe === undefined ? {} : { onDescribe })}
        />
      </FoodLogActionsProvider>
    </ToastProvider>,
  );
}

const describeRow = () => screen.getByRole("button", { name: /^Describe/ });

function putRiceOnThePlate() {
  api.local = [rice];
  fireEvent.change(screen.getByRole("searchbox", { name: "Search foods" }), {
    target: { value: "rice" },
  });
  fireEvent.click(screen.getByRole("button", { name: /^Add Basmati rice, boiled/ }));
  api.local = [];
}

beforeEach(() => {
  api.local = [];
  onlineManager.setOnline(true);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  onlineManager.setOnline(true);
});

describe("Describe, in the add food dialog's idle search", () => {
  it("should offer the row with the phone's words under Quick add", () => {
    renderDialog({ date: "2026-10-15", time: "13:00" }, vi.fn());

    const rows = screen.getAllByRole("button", { name: /Quick add|Describe/ });

    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Quick add"),
      expect.stringContaining(`${ASSISTANT_DESCRIBE.rowTitle}${ASSISTANT_DESCRIBE.rowCaption}`),
    ]);
  });

  it("should open the assistant on the day and the hour the plus asked for", () => {
    const onDescribe = vi.fn<(opening: DescribeInLogOpening) => void>();
    renderDialog({ date: "2026-10-15", time: "13:00" }, onDescribe);

    fireEvent.click(describeRow());

    expect(onDescribe).toHaveBeenCalledExactlyOnceWith({
      localDate: "2026-10-15",
      describeAt: "13:00",
    });
  });

  it("should log at the time on the Time field when the person changed it", () => {
    const onDescribe = vi.fn<(opening: DescribeInLogOpening) => void>();
    renderDialog({ date: "2026-10-15", time: "13:00" }, onDescribe);
    fireEvent.click(screen.getByRole("button", { name: "Time, 13:00, change" }));
    fireEvent.click(
      within(screen.getByRole("listbox", { name: "Hours" })).getByRole("option", { name: "18" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    fireEvent.click(describeRow());

    expect(onDescribe).toHaveBeenCalledExactlyOnceWith({
      localDate: "2026-10-15",
      describeAt: "18:00",
    });
  });

  it("should log at the clock's time on a past day that was opened with no hour", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-20T09:41:00Z"));
    const onDescribe = vi.fn<(opening: DescribeInLogOpening) => void>();
    renderDialog({ date: "2026-10-15" }, onDescribe);

    fireEvent.click(describeRow());

    expect(onDescribe).toHaveBeenCalledExactlyOnceWith({
      localDate: "2026-10-15",
      describeAt: "09:41",
    });
  });

  it("should be off while offline, as the other online-only rows are", () => {
    renderDialog({ date: "2026-10-15" }, vi.fn());

    act(() => {
      onlineManager.setOnline(false);
    });

    expect(describeRow().hasAttribute("disabled")).toBe(true);
  });

  it("should not be offered when nothing can open the assistant", () => {
    renderDialog({ date: "2026-10-15" });

    expect(screen.queryByRole("button", { name: /^Describe/ })).toBeNull();
  });

  describe("with food on the plate", () => {
    it("should ask before the plate is lost, and open nothing while it asks", () => {
      const onDescribe = vi.fn<(opening: DescribeInLogOpening) => void>();
      renderDialog({ date: "2026-10-15", time: "13:00" }, onDescribe);
      putRiceOnThePlate();

      fireEvent.click(describeRow());

      expect(screen.getByRole("dialog", { name: "Discard your plate?" })).toBeTruthy();
      expect(onDescribe).not.toHaveBeenCalled();
    });

    it("should keep the plate and open nothing on Keep adding", () => {
      const onDescribe = vi.fn<(opening: DescribeInLogOpening) => void>();
      renderDialog({ date: "2026-10-15", time: "13:00" }, onDescribe);
      putRiceOnThePlate();
      fireEvent.click(describeRow());

      // Close is named Keep adding too, so the footer's button is found by its text.
      const question = screen.getByRole("dialog", { name: "Discard your plate?" });
      const keepAdding = within(question).getByText("Keep adding").closest("button");
      if (keepAdding === null) {
        throw new Error("Keep adding is not a button");
      }
      fireEvent.click(keepAdding);

      expect(onDescribe).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Your plate, 1 food" })).toBeTruthy();
    });

    it("should open the assistant once the plate is discarded", () => {
      const onDescribe = vi.fn<(opening: DescribeInLogOpening) => void>();
      renderDialog({ date: "2026-10-15", time: "13:00" }, onDescribe);
      putRiceOnThePlate();
      fireEvent.click(describeRow());

      fireEvent.click(screen.getByRole("button", { name: "Discard" }));

      expect(onDescribe).toHaveBeenCalledExactlyOnceWith({
        localDate: "2026-10-15",
        describeAt: "13:00",
      });
    });
  });
});

function OpenAddFood() {
  const { openAddFood } = useFoodLogActions();
  return (
    <button
      type="button"
      onClick={() => {
        openAddFood({ date: "2026-10-15", time: "13:00" });
      }}
    >
      Open Add food
    </button>
  );
}

describe("Describe, when the page has no assistant to open", () => {
  function renderHostedDialog() {
    render(
      <ToastProvider>
        <FoodLogActionsProvider>
          <OpenAddFood />
        </FoodLogActionsProvider>
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open Add food" }));
  }

  it("should leave the dialog open when Describe is pressed", () => {
    renderHostedDialog();

    fireEvent.click(describeRow());

    expect(screen.getByRole("dialog", { name: "Add food" })).toBeTruthy();
  });

  it("should leave the dialog and its plate as they were when a discarded plate has nowhere to go", () => {
    renderHostedDialog();
    putRiceOnThePlate();
    fireEvent.click(describeRow());

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    expect(screen.getByRole("dialog", { name: "Add food" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Your plate, 1 food" })).toBeTruthy();
  });
});
