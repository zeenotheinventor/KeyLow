import { KeyLowProvider } from "@keylow/api-client";
import { accountExportSchema } from "@keylow/core";
import { ACCOUNT_EXPORT_COPY, ACCOUNT_EXPORT_WEB_COPY, OFFLINE_BANNER } from "@keylow/core/copy";
import { createClient } from "@supabase/supabase-js";
import { onlineManager, QueryClient } from "@tanstack/react-query";
import { act, cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithRouter } from "../ui/appRouter";

import type { Database } from "@keylow/api-client";
import type { AccountExport } from "@keylow/core";

import { ExportMyDataScreen } from "@/components/account";

const { exportMyData, router } = vi.hoisted(() => ({
  exportMyData: vi.fn<() => Promise<AccountExport>>(),
  router: { push: vi.fn<(href: string) => void>(), replace: vi.fn<(href: string) => void>() },
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  exportMyData,
}));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const client = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
});

const copy = ACCOUNT_EXPORT_COPY;
const webCopy = ACCOUNT_EXPORT_WEB_COPY;

// Made-up data. The note is padded so the file is 1.8 MB, as the boards show it.
const MARKER = "made-up marker that no screen may print";
function madeUpExport(): AccountExport {
  const emptyTables = accountExportSchema.shape.tables.parse(
    Object.fromEntries(Object.keys(accountExportSchema.shape.tables.shape).map((t) => [t, []])),
  );
  return {
    export_version: 1,
    exported_at: "2026-11-06T09:00:00.000Z",
    account: {
      id: "6f0c6c0e-5b1e-4f2a-9a43-0d2f2f8f7a11",
      email: "someone@keylow.test",
      created_at: "2026-10-01T09:00:00.000Z",
      last_sign_in_at: null,
      providers: ["email"],
    },
    tables: {
      ...emptyTables,
      weigh_ins: [{ id: "a", note: `${MARKER} ${"x".repeat(1_800_000)}` }],
    },
  };
}

// Each read the screen starts waits here until the test answers it, as a slow connection does.
type PendingRead = { resolve: (data: AccountExport) => void; reject: (error: Error) => void };
let reads: PendingRead[];

function answerWithFile(index = reads.length - 1) {
  return act(async () => {
    reads[index]?.resolve(madeUpExport());
    await Promise.resolve();
  });
}

function answerWithFailure(index = reads.length - 1) {
  return act(async () => {
    reads[index]?.reject(new Error("raw database text: 81.6 kg, after the long run"));
    await Promise.resolve();
  });
}

function goOffline() {
  act(() => {
    onlineManager.setOnline(false);
  });
}

function goOnline() {
  act(() => {
    onlineManager.setOnline(true);
  });
}

function renderScreen() {
  return renderWithRouter(
    <KeyLowProvider client={client} queryClient={new QueryClient()}>
      <ExportMyDataScreen />
    </KeyLowProvider>,
  );
}

const saveButton = () => screen.getByRole("button", { name: copy.ready.save });
const offlineTitle = () => screen.queryByText(OFFLINE_BANNER.title);

// What the browser is handed: the Blob behind each object URL, the anchors that were clicked and the URLs revoked.
let blobs: Blob[];
let clicks: Array<{ download: string; href: string }>;
let revoked: string[];
let events: string[];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-06T12:00:00Z"));
  vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(() => ({
    locale: "en-GB",
    calendar: "gregory",
    numberingSystem: "latn",
    timeZone: "UTC",
  }));
  reads = [];
  exportMyData.mockReset();
  exportMyData.mockImplementation(
    () => new Promise<AccountExport>((resolve, reject) => reads.push({ resolve, reject })),
  );
  router.push.mockReset();
  blobs = [];
  clicks = [];
  revoked = [];
  events = [];
  URL.createObjectURL = vi.fn((blob: Blob) => {
    blobs.push(blob);
    return `blob:made-up-${blobs.length}`;
  });
  URL.revokeObjectURL = vi.fn((url: string) => {
    revoked.push(url);
    events.push("revoke");
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function click(
    this: HTMLAnchorElement,
  ) {
    clicks.push({ download: this.download, href: this.href });
    events.push("click");
  });
});

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Export my data, as the page opens", () => {
  it("should start preparing at once, with no Start button, and keep Save file off", () => {
    renderScreen();

    expect(exportMyData).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { level: 1, name: copy.title })).toBeTruthy();
    expect(screen.getByText(copy.preparing.title)).toBeTruthy();
    expect(screen.getByText(copy.preparing.caption)).toBeTruthy();
    expect(saveButton()).toHaveProperty("disabled", true);
    expect(screen.getByText(copy.preparing.footer)).toBeTruthy();
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      copy.ready.save,
    ]);
  });

  it("should go back to More from the link above the title", () => {
    renderScreen();

    expect(screen.getByRole("link", { name: copy.back }).getAttribute("href")).toBe("/more");
  });

  it.each(["preparing", "ready", "downloaded", "failed"])(
    "should keep what the file holds and the health data warning in the %s state",
    async (state) => {
      renderScreen();
      if (state === "failed") {
        await answerWithFailure();
      } else if (state !== "preparing") {
        await answerWithFile();
      }
      if (state === "downloaded") {
        await userEvent.click(saveButton());
      }

      expect(screen.getByRole("region", { name: copy.contents.title })).toBeTruthy();
      expect(screen.getByText(copy.contents.body)).toBeTruthy();
      expect(screen.getByRole("note").textContent).toBe(copy.healthData);
    },
  );
});

describe("Export my data, once the file is ready", () => {
  it("should name the file for today, with its size, a Ready tick and the web footer", async () => {
    renderScreen();

    await answerWithFile();

    expect(screen.getByText("ki-lo-export-2026-11-06.json")).toBeTruthy();
    expect(screen.getByText("1.8 MB · Ready to save")).toBeTruthy();
    expect(screen.getByRole("img", { name: copy.ready.tickLabel })).toBeTruthy();
    expect(saveButton()).toHaveProperty("disabled", false);
    expect(screen.getByRole("button", { name: copy.ready.done })).toBeTruthy();
    expect(screen.getByText(webCopy.ready.footer)).toBeTruthy();
    expect(screen.queryByText(copy.ready.footer)).toBeNull();
  });

  it("should keep the one status region mounted from preparing to downloaded", async () => {
    renderScreen();
    const region = screen.getByRole("status");
    expect(region.getAttribute("aria-live")).toBe("polite");

    await answerWithFile();
    expect(screen.getByRole("status")).toBe(region);

    await userEvent.click(saveButton());
    expect(screen.getByRole("status")).toBe(region);
  });

  it("should go back to More from Done", async () => {
    renderScreen();
    await answerWithFile();

    await userEvent.click(screen.getByRole("button", { name: copy.ready.done }));

    expect(router.push).toHaveBeenCalledWith("/more");
  });

  it("should never print the file's contents", async () => {
    renderScreen();

    await answerWithFile();

    expect(document.body.textContent).not.toContain(MARKER);
  });
});

describe("Export my data, saving the file", () => {
  it("should hand the browser a Blob of the whole file, named for today", async () => {
    renderScreen();
    await answerWithFile();

    await userEvent.click(saveButton());

    expect(blobs).toHaveLength(1);
    expect(blobs[0]?.type).toBe("application/json");
    expect(JSON.parse((await blobs[0]?.text()) ?? "null")).toEqual(madeUpExport());
    expect(clicks).toEqual([{ download: "ki-lo-export-2026-11-06.json", href: "blob:made-up-1" }]);
  });

  it("should revoke the temporary URL 30 seconds after the click, so a slow browser has the file by then", async () => {
    renderScreen();
    await answerWithFile();
    vi.useFakeTimers({ toFake: ["Date", "setTimeout"] });

    act(() => {
      saveButton().click();
    });

    expect(events).toEqual(["click"]);
    vi.advanceTimersByTime(29_999);
    expect(revoked).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(revoked).toEqual(["blob:made-up-1"]);
    expect(events).toEqual(["click", "revoke"]);
  });

  it("should read Downloaded with Done as the only button, since the file is dropped", async () => {
    renderScreen();
    await answerWithFile();

    await userEvent.click(saveButton());

    expect(screen.getByText("1.8 MB · Downloaded")).toBeTruthy();
    expect(screen.getByRole("img", { name: webCopy.saved.tickLabel })).toBeTruthy();
    expect(screen.getByText(webCopy.saved.footer)).toBeTruthy();
    expect(screen.queryByText(copy.saved.footer)).toBeNull();
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      copy.saved.done,
    ]);
  });

  it("should download once however often Save file is pressed in the same moment", async () => {
    renderScreen();
    await answerWithFile();
    const save = saveButton();

    act(() => {
      save.click();
      save.click();
    });

    expect(blobs).toHaveLength(1);
  });

  it("should go back to More from Done once downloaded", async () => {
    renderScreen();
    await answerWithFile();
    await userEvent.click(saveButton());

    await userEvent.click(screen.getByRole("button", { name: copy.saved.done }));

    expect(router.push).toHaveBeenCalledWith("/more");
  });

  it("should show the failed board when the browser cannot be handed the file", async () => {
    renderScreen();
    await answerWithFile();
    URL.createObjectURL = vi.fn(() => {
      throw new Error("raw browser text with the file in it");
    });

    await userEvent.click(saveButton());

    expect(screen.getByRole("alert").textContent).toContain(copy.failed.title);
    expect(document.body.textContent).not.toContain("raw browser text");
  });
});

describe("Export my data, when the export fails", () => {
  it("should show the danger banner and Try again, with Back as the only other way out", async () => {
    renderScreen();

    await answerWithFailure();

    const alert = screen.getByRole("alert");
    expect(within(alert).getByText(copy.failed.title)).toBeTruthy();
    expect(within(alert).getByText(copy.failed.body)).toBeTruthy();
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      copy.failed.retry,
    ]);
    expect(screen.getByRole("link", { name: copy.back })).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("should never print what the failure said", async () => {
    renderScreen();

    await answerWithFailure();

    expect(document.body.textContent).not.toContain("81.6 kg");
  });

  it("should go back to preparing with Try again, and then reach ready", async () => {
    renderScreen();
    await answerWithFailure();

    await userEvent.click(screen.getByRole("button", { name: copy.failed.retry }));

    expect(exportMyData).toHaveBeenCalledTimes(2);
    expect(screen.getByText(copy.preparing.title)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    await answerWithFile();
    expect(screen.getByText("1.8 MB · Ready to save")).toBeTruthy();
  });
});

describe("Export my data, offline", () => {
  it("should show the offline board in the place of the row while preparing, with Save file off", () => {
    onlineManager.setOnline(false);

    renderScreen();

    expect(offlineTitle()).toBeTruthy();
    expect(screen.getByText(webCopy.offline.body)).toBeTruthy();
    expect(screen.queryByText(copy.preparing.title)).toBeNull();
    expect(saveButton()).toHaveProperty("disabled", true);
    expect(screen.getByText(copy.preparing.footer)).toBeTruthy();
  });

  it("should swap the preparing row for the offline board when the connection drops", () => {
    renderScreen();
    expect(screen.getByText(copy.preparing.title)).toBeTruthy();

    goOffline();

    expect(offlineTitle()).toBeTruthy();
    expect(screen.queryByText(copy.preparing.title)).toBeNull();
  });

  it("should keep a failure that happened offline on the offline board, not the failed one", async () => {
    renderScreen();
    goOffline();

    await answerWithFailure();

    expect(offlineTitle()).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: copy.failed.retry })).toBeNull();
    expect(saveButton()).toHaveProperty("disabled", true);
  });

  it("should prepare again once, silently, when the connection returns after a failure offline", async () => {
    renderScreen();
    goOffline();
    await answerWithFailure();
    expect(exportMyData).toHaveBeenCalledOnce();

    goOnline();

    expect(exportMyData).toHaveBeenCalledTimes(2);
    expect(screen.getByText(copy.preparing.title)).toBeTruthy();
    await answerWithFile();
    expect(screen.getByText("1.8 MB · Ready to save")).toBeTruthy();
    expect(exportMyData).toHaveBeenCalledTimes(2);
  });

  it("should not prepare again while the connection is still down", async () => {
    renderScreen();
    goOffline();
    await answerWithFailure();

    await act(async () => {
      await Promise.resolve();
    });

    expect(exportMyData).toHaveBeenCalledOnce();
  });

  it("should leave a failure that happened online on the failed board, offline or not", async () => {
    renderScreen();
    await answerWithFailure();

    goOffline();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: copy.failed.retry })).toBeTruthy();
    expect(offlineTitle()).toBeNull();

    goOnline();
    expect(exportMyData).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("should not retry a failure that happened online on any later reconnect", async () => {
    renderScreen();
    await answerWithFailure();

    goOffline();
    goOnline();
    goOffline();
    goOnline();

    expect(exportMyData).toHaveBeenCalledOnce();
  });

  it("should count a silent prepare that fails as an online failure, with no further attempt", async () => {
    renderScreen();
    goOffline();
    await answerWithFailure();
    goOnline();
    expect(exportMyData).toHaveBeenCalledTimes(2);

    await answerWithFailure();

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: copy.failed.retry })).toBeTruthy();
    goOffline();
    goOnline();
    expect(exportMyData).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("should treat a press of Try again offline as a new attempt, and its failure offline as offline", async () => {
    renderScreen();
    await answerWithFailure();
    goOffline();

    await userEvent.click(screen.getByRole("button", { name: copy.failed.retry }));

    expect(exportMyData).toHaveBeenCalledTimes(2);
    expect(offlineTitle()).toBeTruthy();
    await answerWithFailure();
    expect(offlineTitle()).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();

    goOnline();

    expect(exportMyData).toHaveBeenCalledTimes(3);
  });

  it("should keep a file that is ready ready offline, with no banner, and still download it", async () => {
    renderScreen();
    await answerWithFile();

    goOffline();

    expect(offlineTitle()).toBeNull();
    expect(screen.getByText("1.8 MB · Ready to save")).toBeTruthy();
    expect(saveButton()).toHaveProperty("disabled", false);
    await userEvent.click(saveButton());
    expect(screen.getByText("1.8 MB · Downloaded")).toBeTruthy();
    expect(clicks).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: copy.saved.done }));
    expect(router.push).toHaveBeenCalledWith("/more");
  });
});
