import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { diaryDay, entryLoggedFrom } from "./support";
import {
  BRANDED_CODE,
  FETCHED_AFTER_THE_RULES,
  OffRefreshProvider,
  holdRefresh,
  letRequestsArrive,
  offRefreshBackend,
  oldBrandedFood,
  oldBrandedPortions,
  resetOffRefreshBackend,
  storeOldBrandedFood,
} from "../foods/offRefreshBackend";

import type { DiaryDay, LogEntry } from "@keylow/api-client";
import type { Food } from "@keylow/core/schemas";

import { EditEntryDialog } from "@/components/diary/EditEntryDialog";
import { ToastProvider } from "@/components/ui/Toast";

const diary = vi.hoisted((): { entries: LogEntry[] } => ({ entries: [] }));

// The day and the time zone are other tests' business. The food, its portions and the refresh are real.
vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useProfileTimeZone: () => ({ data: "UTC" }),
  useDiaryDay: (date: string): { data: DiaryDay } => ({
    data: diaryDay(date, diary.entries),
  }),
}));

const TODAY = "2026-10-15";

function openEntryOf(food: Food) {
  const entry = entryLoggedFrom({
    food,
    foodPortions: oldBrandedPortions(food),
    quantity: 150,
    unit: "g",
    date: TODAY,
    time: "12:40",
  });
  diary.entries = [entry];
  render(
    <OffRefreshProvider>
      <ToastProvider>
        <EditEntryDialog entryId={entry.id} date={TODAY} opener={null} onClose={vi.fn()} />
      </ToastProvider>
    </OffRefreshProvider>,
  );
}

const amount = () => screen.getByRole("textbox", { name: /^Amount/ });
const hero = () => screen.getByRole("group", { name: "Energy and macros, For 150 g" });

beforeEach(() => {
  resetOffRefreshBackend();
});

afterEach(() => {
  cleanup();
});

describe("the edit entry dialog for a food logged from an old branded food", () => {
  it("should ask off-product once for the food's code and add the new chip with no message", async () => {
    const food = oldBrandedFood();
    storeOldBrandedFood(food);
    openEntryOf(food);
    await screen.findByRole("radio", { name: "1 serving" });

    await screen.findByRole("radio", { name: "1 can" });

    expect(offRefreshBackend.refreshedCodes).toEqual([BRANDED_CODE]);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("should leave the logged amount and the entry's own values as they were", async () => {
    const food = oldBrandedFood();
    storeOldBrandedFood(food);
    openEntryOf(food);
    await screen.findByRole("radio", { name: "1 serving" });
    const heroBefore = hero().textContent;

    await screen.findByRole("radio", { name: "1 can" });

    expect(amount()).toHaveProperty("value", "150");
    expect(screen.getByRole("radio", { name: "g", checked: true })).toBeTruthy();
    expect(hero().textContent).toBe(heroBefore);
  });

  it("should keep the chip picked and the amount typed before the refresh lands, and leave Save enabled", async () => {
    const food = oldBrandedFood();
    storeOldBrandedFood(food);
    const release = holdRefresh();
    openEntryOf(food);
    await screen.findByRole("radio", { name: "1 bottle" });
    fireEvent.click(screen.getByRole("radio", { name: "1 bottle" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Amount (bottle)" }), {
      target: { value: "2" },
    });

    release();
    await screen.findByRole("radio", { name: "1 can" });

    expect(screen.getByRole("radio", { name: "1 bottle", checked: true })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Amount (bottle)" })).toHaveProperty("value", "2");
    expect(screen.getByRole("button", { name: "Save" })).toHaveProperty("disabled", false);
  });

  it("should keep the amount typed before the refresh lands", async () => {
    const food = oldBrandedFood();
    storeOldBrandedFood(food);
    const release = holdRefresh();
    openEntryOf(food);
    await screen.findByRole("radio", { name: "1 bottle" });
    fireEvent.change(amount(), { target: { value: "180" } });

    release();
    await screen.findByRole("radio", { name: "1 can" });

    expect(amount()).toHaveProperty("value", "180");
    expect(screen.getByRole("radio", { name: "g", checked: true })).toBeTruthy();
  });

  it("should keep the old chips and show nothing when off-product is rate limited", async () => {
    const food = oldBrandedFood();
    storeOldBrandedFood(food);
    offRefreshBackend.refreshFails = "rateLimited";
    openEntryOf(food);
    await screen.findByRole("radio", { name: "1 serving" });

    await waitFor(() => {
      expect(offRefreshBackend.refreshedCodes).toHaveLength(1);
    });
    await letRequestsArrive();

    expect(screen.queryByRole("radio", { name: "1 can" })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("should not ask off-product when the food has been deleted", async () => {
    const food = oldBrandedFood({ deleted_at: "2026-10-16T09:00:00+00:00" });
    storeOldBrandedFood(food);
    openEntryOf(food);

    await letRequestsArrive();

    expect(offRefreshBackend.refreshedCodes).toEqual([]);
  });

  it.each<[string, Partial<Food>]>([
    ["an Open Food Facts food fetched since the rules", { fetched_at: FETCHED_AFTER_THE_RULES }],
    ["a CoFID food", { source: "cofid", source_ref: "13-123", barcode: null }],
    ["a USDA food", { source: "usda", source_ref: "170000", barcode: null }],
    ["a food of the person's own", { source: "user", source_ref: null, fetched_at: null }],
    ["an Open Food Facts food with no source reference", { source_ref: null }],
  ])("should not ask off-product for %s", async (_name, overrides) => {
    const food = oldBrandedFood(overrides);
    storeOldBrandedFood(food);
    openEntryOf(food);
    await screen.findByRole("radio", { name: "1 serving" });

    await letRequestsArrive();

    expect(offRefreshBackend.refreshedCodes).toEqual([]);
  });
});
