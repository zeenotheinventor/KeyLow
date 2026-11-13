import { onlineManager } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/Toast";
import { PlateProvider, useLogPlate, usePlate } from "@/lib/plate";

const navigation = vi.hoisted(() => ({
  push: vi.fn<(href: string) => void>(),
  pathname: "/dashboard",
  search: "",
}));

const logPlateEntries = vi.hoisted(() => ({ mutateAsync: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push }),
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useLogPlateEntries: () => logPlateEntries,
  useProfileTimeZone: () => ({ data: "UTC" }),
}));

// 12:40 on Thursday 15 October 2026 in UTC.
const NOW = new Date("2026-10-15T12:40:30Z");

function Harness({ day, onLogged }: { day?: string; onLogged: () => void }) {
  const plate = usePlate();
  const { logPlate } = useLogPlate(day, onLogged);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          plate.add((key) => ({
            kind: "food",
            key,
            foodId: "11111111-1111-4111-8111-111111111111",
            name: "Chicken breast, grilled",
            quantityText: "100",
            quantity: 100,
            unit: { kind: "g" },
            perUnit: { kcal: 1.48, protein_g: 0.32, carbs_g: 0, fat_g: 0.022 },
          }));
        }}
      >
        Add chicken
      </button>
      <button
        type="button"
        onClick={() => {
          void logPlate();
        }}
      >
        Log
      </button>
    </>
  );
}

function renderHarness({
  pathname,
  search = "",
  day,
}: {
  pathname: string;
  search?: string;
  day?: string;
}) {
  navigation.pathname = pathname;
  navigation.search = search;
  const onLogged = vi.fn<() => void>();
  render(
    <ToastProvider>
      <PlateProvider initialTime={undefined}>
        <Harness {...(day === undefined ? {} : { day })} onLogged={onLogged} />
      </PlateProvider>
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Add chicken" }));
  return onLogged;
}

// A successful log has closed the dialog once `onLogged` has been called, and the navigation comes after it.
async function pressLogAndWaitForSuccess(onLogged: () => void) {
  fireEvent.click(screen.getByRole("button", { name: "Log" }));
  await waitFor(() => {
    expect(onLogged).toHaveBeenCalledTimes(1);
  });
}

describe("useLogPlate navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    onlineManager.setOnline(true);
    logPlateEntries.mutateAsync.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("goes to today's Diary when the plate is logged from the Dashboard", async () => {
    const onLogged = renderHarness({ pathname: "/dashboard" });

    await pressLogAndWaitForSuccess(onLogged);

    expect(navigation.push).toHaveBeenCalledExactlyOnceWith("/diary");
    expect(onLogged).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Chicken breast, grilled/)).toBeTruthy();
  });

  it("goes to today's Diary when the plate is logged from the barcode panel on Foods", async () => {
    const onLogged = renderHarness({ pathname: "/foods", search: "panel=barcode" });

    await pressLogAndWaitForSuccess(onLogged);

    expect(navigation.push).toHaveBeenCalledExactlyOnceWith("/diary");
  });

  it("goes to the day written when the plate is for another day", async () => {
    const onLogged = renderHarness({ pathname: "/dashboard", day: "2026-10-10" });

    await pressLogAndWaitForSuccess(onLogged);

    expect(navigation.push).toHaveBeenCalledExactlyOnceWith("/diary?date=2026-10-10");
  });

  it("stays put when the Diary already shows today", async () => {
    const onLogged = renderHarness({ pathname: "/diary" });

    await pressLogAndWaitForSuccess(onLogged);

    expect(navigation.push).not.toHaveBeenCalled();
    expect(onLogged).toHaveBeenCalledTimes(1);
  });

  it("stays put when the Diary already shows the day written", async () => {
    const onLogged = renderHarness({
      pathname: "/diary",
      search: "date=2026-10-10",
      day: "2026-10-10",
    });

    await pressLogAndWaitForSuccess(onLogged);

    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("goes to today when the Diary shows another day", async () => {
    const onLogged = renderHarness({ pathname: "/diary", search: "date=2026-10-10" });

    await pressLogAndWaitForSuccess(onLogged);

    expect(navigation.push).toHaveBeenCalledExactlyOnceWith("/diary");
  });

  it("stays put when the Diary asks for a day after today, since it shows today", async () => {
    const onLogged = renderHarness({ pathname: "/diary", search: "date=2099-01-01" });

    await pressLogAndWaitForSuccess(onLogged);

    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("goes to today when the Diary is on its week view", async () => {
    const onLogged = renderHarness({ pathname: "/diary", search: "view=week" });

    await pressLogAndWaitForSuccess(onLogged);

    expect(navigation.push).toHaveBeenCalledExactlyOnceWith("/diary");
  });

  it("goes nowhere when the log fails", async () => {
    logPlateEntries.mutateAsync.mockRejectedValue(new Error("write failed"));
    const onLogged = renderHarness({ pathname: "/dashboard" });

    fireEvent.click(screen.getByRole("button", { name: "Log" }));

    await waitFor(() => {
      expect(screen.getByText("Not logged. Check your connection and try again.")).toBeTruthy();
    });
    expect(navigation.push).not.toHaveBeenCalled();
    expect(onLogged).not.toHaveBeenCalled();
  });
});
