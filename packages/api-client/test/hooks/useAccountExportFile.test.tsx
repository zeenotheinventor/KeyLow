import {
  ACCOUNT_EXPORT_TABLES,
  ACCOUNT_EXPORT_VERSION,
  accountExportSchema,
  serialiseAccountExport,
} from "@keylow/core";
import { formatFileSize } from "@keylow/core/format";
import { onlineManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAccountExportFile } from "../../src/hooks/useAccountExportFile";

import type { AccountExport } from "@keylow/core";

// Parsing builds the typed object, so no cast is needed to say that each of the tables is an empty list.
const emptyTables = (): AccountExport["tables"] =>
  accountExportSchema.shape.tables.parse(
    Object.fromEntries(ACCOUNT_EXPORT_TABLES.map((table) => [table, []])),
  );

const madeUpAccountExport = (): AccountExport => ({
  export_version: ACCOUNT_EXPORT_VERSION,
  exported_at: "2026-11-04T10:00:00.000Z",
  account: {
    id: "6f0c6c0e-5b1e-4f2a-9a43-0d2f2f8f7a11",
    email: "someone@keylow.test",
    created_at: "2026-10-01T09:00:00.000Z",
    last_sign_in_at: null,
    providers: ["email"],
  },
  tables: { ...emptyTables(), weigh_ins: [{ id: "a", weight_kg: 80.5, note: "after a run" }] },
});

const madeUpSizeBytes = new TextEncoder().encode(
  serialiseAccountExport(madeUpAccountExport()),
).length;

const readExport = vi.fn<() => Promise<AccountExport>>();

type Props = { isActive: boolean };

function renderExportFile(initialProps: Props = { isActive: true }) {
  return renderHook(({ isActive }: Props) => useAccountExportFile({ isActive, readExport }), {
    initialProps,
  });
}

beforeEach(() => {
  readExport.mockReset();
  readExport.mockResolvedValue(madeUpAccountExport());
  onlineManager.setOnline(true);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-04T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useAccountExportFile preparing", () => {
  it("should prepare the file once the hook is active, with its name and size", async () => {
    const { result } = renderExportFile();

    await waitFor(() => {
      expect(result.current.state).toEqual({ status: "ready", sizeBytes: madeUpSizeBytes });
    });
    expect(result.current.fileName).toBe("ki-lo-export-2026-11-04.json");
    expect(result.current.sizeText).toBe(formatFileSize(madeUpSizeBytes));
    expect(result.current.readFile()).toEqual({
      name: "ki-lo-export-2026-11-04.json",
      text: serialiseAccountExport(madeUpAccountExport()),
    });
  });

  it("should read nothing while it is not active", () => {
    const { result } = renderExportFile({ isActive: false });

    expect(readExport).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({ status: "idle" });
    expect(result.current.sizeText).toBeUndefined();
  });

  it("should start the export once when React starts it twice", async () => {
    const { result } = renderHook(() => useAccountExportFile({ isActive: true, readExport }), {
      wrapper: StrictMode,
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe("ready");
    });
    expect(readExport).toHaveBeenCalledTimes(1);
  });

  it("should let a retry pressed during preparing join the export that is running", () => {
    readExport.mockReturnValue(new Promise<AccountExport>(() => undefined));
    const { result } = renderExportFile();

    act(() => {
      result.current.dispatch({ type: "retry" });
    });

    expect(readExport).toHaveBeenCalledTimes(1);
    expect(result.current.state).toEqual({ status: "preparing" });
  });

  it("should report only the step that failed, never the error", async () => {
    readExport.mockRejectedValue(new Error("weigh_ins 80.5 kg for someone@keylow.test"));
    const { result } = renderExportFile();

    await waitFor(() => {
      expect(result.current.state.status).toBe("failed");
    });
    expect(result.current.state).toEqual({ status: "failed", step: "preparing" });
    expect(result.current.fileName).toBeUndefined();
    expect(result.current.readFile()).toBeNull();
  });
});

describe("useAccountExportFile events a screen may send", () => {
  it("should not take the events that only the hook sends", () => {
    const { result } = renderExportFile({ isActive: false });

    // @ts-expect-error reset is isActive's, and sending it would leave a held file under an idle state
    result.current.dispatch({ type: "reset" });
    // @ts-expect-error start is isActive's
    result.current.dispatch({ type: "start" });
    // @ts-expect-error prepared is the hook's own, once the file is read
    result.current.dispatch({ type: "prepared", sizeBytes: 1 });

    expect(result.current.state).toEqual({ status: "idle" });
  });
});

describe("useAccountExportFile letting go of the file", () => {
  it("should drop the file, the name and the state when it stops being active", async () => {
    const { result, rerender } = renderExportFile();
    await waitFor(() => {
      expect(result.current.state.status).toBe("ready");
    });

    rerender({ isActive: false });

    expect(result.current.readFile()).toBeNull();
    expect(result.current.fileName).toBeUndefined();
    expect(result.current.state).toEqual({ status: "idle" });
  });

  it("should prepare a new file, not bring back the old one, when it is active again", async () => {
    const { result, rerender } = renderExportFile();
    await waitFor(() => {
      expect(result.current.state.status).toBe("ready");
    });
    rerender({ isActive: false });

    rerender({ isActive: true });

    await waitFor(() => {
      expect(result.current.state.status).toBe("ready");
    });
    expect(readExport).toHaveBeenCalledTimes(2);
  });

  it("should not hold a file that finished preparing after it stopped being active", async () => {
    let resolveExport: (data: AccountExport) => void = () => undefined;
    readExport.mockReturnValue(
      new Promise<AccountExport>((resolve) => {
        resolveExport = resolve;
      }),
    );
    const { result, rerender } = renderExportFile();

    rerender({ isActive: false });
    await act(async () => {
      resolveExport(madeUpAccountExport());
      await Promise.resolve();
    });

    expect(result.current.readFile()).toBeNull();
    expect(result.current.state).toEqual({ status: "idle" });
  });

  it("should drop the file once it is saved", async () => {
    const { result } = renderExportFile();
    await waitFor(() => {
      expect(result.current.state.status).toBe("ready");
    });

    act(() => {
      result.current.dispatch({ type: "save" });
      result.current.dispatch({ type: "savedTo", folderName: "" });
    });

    expect(result.current.state.status).toBe("saved");
    expect(result.current.readFile()).toBeNull();
    expect(result.current.sizeText).toBe(formatFileSize(madeUpSizeBytes));
  });

  it("should drop the file when saving it fails", async () => {
    const { result } = renderExportFile();
    await waitFor(() => {
      expect(result.current.state.status).toBe("ready");
    });

    act(() => {
      result.current.dispatch({ type: "save" });
      result.current.dispatch({ type: "failedWhile", step: "saving" });
    });

    expect(result.current.state).toEqual({ status: "failed", step: "saving" });
    expect(result.current.readFile()).toBeNull();
  });

  it("should keep the file when the person backs out of saving it", async () => {
    const { result } = renderExportFile();
    await waitFor(() => {
      expect(result.current.state.status).toBe("ready");
    });

    act(() => {
      result.current.dispatch({ type: "save" });
      result.current.dispatch({ type: "pickerCancelled" });
    });

    expect(result.current.state.status).toBe("ready");
    expect(result.current.readFile()).not.toBeNull();
  });
});

describe("useAccountExportFile retry", () => {
  it("should prepare again from a failure", async () => {
    readExport.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderExportFile();
    await waitFor(() => {
      expect(result.current.state.status).toBe("failed");
    });

    act(() => {
      result.current.dispatch({ type: "retry" });
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe("ready");
    });
    expect(readExport).toHaveBeenCalledTimes(2);
  });

  it("should read with the reader it was last given, not the first", async () => {
    const firstReader = vi.fn<() => Promise<AccountExport>>().mockRejectedValue(new Error("first"));
    const laterReader = vi
      .fn<() => Promise<AccountExport>>()
      .mockResolvedValue(madeUpAccountExport());
    const { result, rerender } = renderHook(
      ({ reader }: { reader: () => Promise<AccountExport> }) =>
        useAccountExportFile({ isActive: true, readExport: reader }),
      { initialProps: { reader: firstReader } },
    );
    await waitFor(() => {
      expect(result.current.state.status).toBe("failed");
    });
    rerender({ reader: laterReader });

    act(() => {
      result.current.dispatch({ type: "retry" });
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe("ready");
    });
    expect(firstReader).toHaveBeenCalledTimes(1);
    expect(laterReader).toHaveBeenCalledTimes(1);
  });

  it("should run the export again only from a failure", async () => {
    const { result } = renderExportFile();
    await waitFor(() => {
      expect(result.current.state.status).toBe("ready");
    });

    act(() => {
      result.current.dispatch({ type: "retry" });
    });

    expect(readExport).toHaveBeenCalledTimes(1);
    expect(result.current.state.status).toBe("ready");
  });

  it("should drop a file that was held when a failed save is retried", async () => {
    const { result } = renderExportFile();
    await waitFor(() => {
      expect(result.current.state.status).toBe("ready");
    });
    act(() => {
      result.current.dispatch({ type: "save" });
      result.current.dispatch({ type: "failedWhile", step: "saving" });
    });
    readExport.mockReturnValue(new Promise<AccountExport>(() => undefined));

    act(() => {
      result.current.dispatch({ type: "retry" });
    });

    expect(result.current.state).toEqual({ status: "preparing" });
    expect(result.current.fileName).toBeUndefined();
    expect(result.current.readFile()).toBeNull();
  });
});

describe("useAccountExportFile and the connection", () => {
  it("should say the preparing failure happened offline when the connection was down at that moment", async () => {
    onlineManager.setOnline(false);
    readExport.mockRejectedValue(new Error("offline"));
    const { result } = renderExportFile();
    await waitFor(() => {
      expect(result.current.state.status).toBe("failed");
    });
    onlineManager.setOnline(true);

    expect(result.current.wasOfflineAtFailure()).toBe(true);
  });

  it("should say the failure happened online when the connection was up at that moment", async () => {
    readExport.mockRejectedValue(new Error("server error"));
    const { result } = renderExportFile();
    await waitFor(() => {
      expect(result.current.state.status).toBe("failed");
    });
    onlineManager.setOnline(false);

    expect(result.current.wasOfflineAtFailure()).toBe(false);
  });

  it("should forget an offline failure once the export is retried", async () => {
    onlineManager.setOnline(false);
    readExport.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderExportFile();
    await waitFor(() => {
      expect(result.current.state.status).toBe("failed");
    });
    readExport.mockReturnValue(new Promise<AccountExport>(() => undefined));

    act(() => {
      result.current.dispatch({ type: "retry" });
    });

    expect(result.current.wasOfflineAtFailure()).toBe(false);
  });
});
