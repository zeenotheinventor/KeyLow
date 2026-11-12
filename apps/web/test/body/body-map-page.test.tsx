import { RESTING_HEAT } from "@keylow/api-client";
import { BODY_MAP } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BodyMap, TrainingReadResult } from "@keylow/api-client";

import BodyMapPage from "@/app/(dashboard)/body-map/page";
import { ToastProvider } from "@/components/ui/Toast";
import { resetBodyFigureForTests } from "@/lib/bodyFigure/testing";

vi.mock("next/navigation", () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn() }) }));
vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useProfileTimeZone: () => ({ data: "Europe/London" }),
  useStartSessionAction: () => ({ start: vi.fn(), isStarting: false }),
  useBodyMap: () => read(bodyMap),
  useMuscleList: () => read(undefined),
  useMuscleScaleList: () => read(undefined),
  useActiveRoutine: () => read(null),
}));

const read = <Data,>(data: Data): TrainingReadResult<Data> => ({
  data,
  isPending: false,
  isError: false,
  error: null,
  refetch: () => Promise.resolve(),
});

// Thursday 15 October 2026 at 19:00 in London, the agreed golden week.
const THURSDAY_19_00 = "2026-10-15T18:00:00.000Z";
const bodyMap: BodyMap = {
  values: { ...RESTING_HEAT },
  computedAt: THURSDAY_19_00,
  days: [],
  todayProjectedIsActual: true,
  projectedAvailable: true,
  nothingLogged: false,
};

// Next 16 gives the page its address parameters as a promise, so the page is awaited as the framework awaits it.
const renderPage = async (parameters: Record<string, string | string[] | undefined>) =>
  render(await BodyMapPage({ searchParams: Promise.resolve(parameters) }), {
    wrapper: ToastProvider,
  });

const checkedScale = () =>
  within(screen.getByRole("radiogroup", { name: BODY_MAP.scaleSwitch.name }))
    .getAllByRole("radio")
    .filter((radio) => radio instanceof HTMLInputElement && radio.checked)
    .map((radio) => radio.closest("label")?.textContent);

describe("the body map page", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("bodyMap.figure", "male");
    // The first-open hint was dismissed on an earlier visit, so only its own tests see it.
    window.localStorage.setItem("bodyMap.hintSeen", "true");
    resetBodyFigureForTests();
    onlineManager.setOnline(true);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(THURSDAY_19_00));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("should open on Volume when the address says scale=volume", async () => {
    await renderPage({ scale: "volume" });

    expect(checkedScale()).toStrictEqual(["Volume"]);
  });

  it.each([
    ["no scale", {}],
    ["scale=gap", { scale: "gap" }],
    ["scale=heat", { scale: "heat" }],
    ["scale given twice", { scale: ["volume", "gap"] }],
  ])("should open on Heat for %s", async (_name, parameters) => {
    await renderPage(parameters);

    expect(checkedScale()).toStrictEqual(["Heat"]);
  });
});
