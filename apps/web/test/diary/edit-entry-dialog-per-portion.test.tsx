import { buildLogEntry } from "@keylow/core/diary";
import { onlineManager } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { diaryDay } from "./support";
import { makeFood, makePortion } from "../foods/support";

import type { DiaryDay, EntryUpdate, LogEntry } from "@keylow/api-client";
import type { Food, FoodPortion } from "@keylow/core/schemas";

import { EditEntryDialog } from "@/components/diary/EditEntryDialog";
import { ToastProvider } from "@/components/ui/Toast";

type Api = {
  timeZone: string;
  entries: LogEntry[];
  food: Food | null | undefined;
  portions: FoodPortion[] | undefined;
  updateEntry: {
    mutateAsync: ReturnType<typeof vi.fn<(update: EntryUpdate) => Promise<LogEntry>>>;
  };
  deleteEntry: { mutateAsync: ReturnType<typeof vi.fn<(entry: LogEntry) => Promise<void>>> };
  restoreEntry: { mutateAsync: ReturnType<typeof vi.fn<(entry: LogEntry) => Promise<void>>> };
};

const api = vi.hoisted((): Api => ({
  timeZone: "UTC",
  entries: [],
  food: undefined,
  portions: [],
  updateEntry: { mutateAsync: undefined as never },
  deleteEntry: { mutateAsync: undefined as never },
  restoreEntry: { mutateAsync: undefined as never },
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  // The refresh of an old branded food is the off refresh tests' business.
  useRefreshOutdatedOffFood: () => undefined,
  useProfileTimeZone: () => ({ data: api.timeZone }),
  useDiaryDay: (date: string): { data: DiaryDay } => ({ data: diaryDay(date, api.entries) }),
  useFood: () => ({ data: api.food }),
  useFoodPortions: () => ({ data: api.portions }),
  useUpdateEntry: () => api.updateEntry,
  useDeleteEntry: () => api.deleteEntry,
  useRestoreEntry: () => api.restoreEntry,
}));

const TODAY = "2026-10-15";

const bucket = makeFood({
  id: "55555555-5555-4555-8555-555555555555",
  owner_id: null,
  source: "restaurant",
  name: "Bargain bucket",
  basis: "per_portion",
  kcal: 500,
  protein_g: 40,
  fat_g: 30,
  carbs_g: 20,
  fibre_g: null,
  quality: {},
});
const bucketPortion = makePortion({
  id: "66666666-6666-4666-8666-666666666666",
  food_id: bucket.id,
  owner_id: null,
  label: "1 bucket",
  grams: null,
  ml: null,
  is_default: true,
});

function bucketEntry(): LogEntry {
  const entry = buildLogEntry({
    food: bucket,
    quantity: 1.5,
    unit: "portion",
    portion: bucketPortion,
    localDate: TODAY,
    loggedAt: `${TODAY}T12:40:00+00:00`,
  });

  return {
    ...entry,
    id: "99999999-9999-4999-8999-999999999999",
    created_at: `${TODAY}T12:40:30+00:00`,
    kcal: entry.nutrients.kcal,
  };
}

const amount = () => screen.getByRole("textbox", { name: /^Amount/ });

beforeEach(() => {
  api.timeZone = "UTC";
  api.food = bucket;
  api.portions = [bucketPortion];
  api.updateEntry.mutateAsync = vi.fn((update: EntryUpdate) => Promise.resolve(update.entry));
  api.deleteEntry.mutateAsync = vi.fn(() => Promise.resolve());
  api.restoreEntry.mutateAsync = vi.fn(() => Promise.resolve());
});

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
});

describe("the edit entry dialog for a food with no published weight", () => {
  function renderDialog(entry: LogEntry) {
    api.entries = [entry];
    const onClose = vi.fn<() => void>();
    render(
      <ToastProvider>
        <EditEntryDialog entryId={entry.id} date={TODAY} opener={null} onClose={onClose} />
      </ToastProvider>,
    );

    return { onClose };
  }

  it("should open on the count with only the portion chip and no grams", () => {
    renderDialog(bucketEntry());

    expect(amount()).toHaveProperty("value", "1.5");
    expect(screen.getAllByRole("radio").map((chip) => chip.textContent)).toEqual(["1 bucket"]);
    const hero = screen.getByRole("group", { name: "Energy and macros, For 1.5 × 1 bucket" });
    expect(within(hero).getByText("750")).toBeTruthy();
    expect(screen.queryByText(/100 g/)).toBeNull();
  });

  it("should keep the count when it is edited", async () => {
    const entry = bucketEntry();
    const { onClose } = renderDialog(entry);

    fireEvent.change(amount(), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
    });
    expect(api.updateEntry.mutateAsync).toHaveBeenCalledExactlyOnceWith({
      entry,
      amount: { quantity: 2, unit: "portion" },
    });
  });
});
