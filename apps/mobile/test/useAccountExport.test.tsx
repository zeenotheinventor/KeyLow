import { act, renderHook, waitFor } from "@testing-library/react-native";

import { fakePickedDirectory, madeUpAccountExport } from "./support/accountExportFixtures";
import { useAccountExport } from "../components/ExportMyDataScreen/useAccountExport";

import type { AccountExport } from "@keylow/core";

type PickedDirectory = ReturnType<typeof fakePickedDirectory>;

// What the two outside calls answer. The read is tested where it lives, in `@keylow/api-client`.
const mockBackend: {
  exportMyData: jest.Mock<Promise<AccountExport>, []>;
  pickDirectory: jest.Mock<Promise<PickedDirectory>, []>;
} = {
  exportMyData: jest.fn<Promise<AccountExport>, []>(),
  pickDirectory: jest.fn<Promise<PickedDirectory>, []>(),
};

jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  exportMyData: () => mockBackend.exportMyData(),
}));
jest.mock("expo-file-system", () => ({
  Directory: { pickDirectoryAsync: () => mockBackend.pickDirectory() },
}));
jest.mock("../lib/supabase", () => ({
  supabase: jest.requireActual<{ mockSupabaseClient: unknown }>("./support/supabaseMock")
    .mockSupabaseClient,
}));

// The file is health data and is held only while the screen is open and the file is unsaved, so each of these
// leaves a hook that has let go of it and a Save file that finds nothing to write.
describe("useAccountExport letting go of the file", () => {
  beforeEach(() => {
    mockBackend.exportMyData.mockReset();
    mockBackend.pickDirectory.mockReset();
    mockBackend.exportMyData.mockResolvedValue(madeUpAccountExport());
  });

  it("should write nothing and ask for no folder once the screen has been left", async () => {
    const { result, unmount } = await renderHook(() => useAccountExport());
    await waitFor(() => {
      expect(result.current.state.status).toBe("ready");
    });

    // The hook's result is gone once it is unmounted, so Save file is kept from the screen that was left.
    const { save } = result.current;
    await unmount();
    await act(async () => {
      await save();
    });

    expect(mockBackend.pickDirectory).not.toHaveBeenCalled();
  });

  it("should not hold a file that was prepared after the screen was left", async () => {
    let resolveExport: (data: AccountExport) => void = () => undefined;
    mockBackend.exportMyData.mockReturnValue(
      new Promise<AccountExport>((resolve) => {
        resolveExport = resolve;
      }),
    );
    const { result, unmount } = await renderHook(() => useAccountExport());
    const { save } = result.current;

    await unmount();
    await act(() => {
      resolveExport(madeUpAccountExport());
    });
    await act(async () => {
      await save();
    });

    expect(mockBackend.pickDirectory).not.toHaveBeenCalled();
  });

  it("should write nothing a second time once the file is saved", async () => {
    const folder = fakePickedDirectory("Downloads");
    mockBackend.pickDirectory.mockResolvedValue(folder);
    const { result } = await renderHook(() => useAccountExport());
    await waitFor(() => {
      expect(result.current.state.status).toBe("ready");
    });
    await act(async () => {
      await result.current.save();
    });

    await act(async () => {
      await result.current.save();
    });

    expect(result.current.state.status).toBe("saved");
    expect(mockBackend.pickDirectory).toHaveBeenCalledTimes(1);
    expect(folder.write).toHaveBeenCalledTimes(1);
  });

  it("should write nothing again after a failed save, until the export is run again", async () => {
    const folder = fakePickedDirectory("Downloads");
    folder.write.mockImplementation(() => {
      throw new Error("no space left");
    });
    mockBackend.pickDirectory.mockResolvedValue(folder);
    const { result } = await renderHook(() => useAccountExport());
    await waitFor(() => {
      expect(result.current.state.status).toBe("ready");
    });
    await act(async () => {
      await result.current.save();
    });

    await act(async () => {
      await result.current.save();
    });

    expect(result.current.state).toEqual({ status: "failed", step: "saving" });
    expect(mockBackend.pickDirectory).toHaveBeenCalledTimes(1);
  });

  it("should run the export again only from a failure", async () => {
    const { result } = await renderHook(() => useAccountExport());
    await waitFor(() => {
      expect(result.current.state.status).toBe("ready");
    });

    await act(() => {
      result.current.retry();
    });

    expect(mockBackend.exportMyData).toHaveBeenCalledTimes(1);
    expect(result.current.state.status).toBe("ready");
  });
});
