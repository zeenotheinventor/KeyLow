import { act, renderHook, waitFor } from "@testing-library/react-native";

import {
  defaultReminderSettings,
  readReminderSettings,
  reminderSettingsStorageKey,
  useReminderSettings,
  writeReminderSettings,
} from "../lib/reminderSettings";

const mockStorageItems = new Map<string, string>();
const mockGetItem = jest.fn((key: string) => Promise.resolve(mockStorageItems.get(key) ?? null));
const mockSetItem = jest.fn((key: string, value: string) => {
  mockStorageItems.set(key, value);
  return Promise.resolve();
});

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => mockGetItem(key),
    setItem: (key: string, value: string) => mockSetItem(key, value),
  },
}));

// Makes the next read of storage wait until the test lets it finish.
function holdNextRead() {
  let release: (value: string) => void = () => undefined;
  mockGetItem.mockReturnValueOnce(
    new Promise<string | null>((resolve) => {
      release = resolve;
    }),
  );
  return {
    finishWith: (settings: object) => {
      release(JSON.stringify(settings));
    },
  };
}

describe("reminder settings", () => {
  beforeEach(() => {
    mockStorageItems.clear();
    mockGetItem.mockClear();
    mockSetItem.mockClear();
  });

  describe("defaults", () => {
    it("should have every reminder off, the train time at 17:30 and no variant used yet", () => {
      expect(defaultReminderSettings).toEqual({
        trainEnabled: false,
        progressEnabled: false,
        easeEnabled: false,
        trainTime: "17:30",
        lastVariant: { train: null, progress: null, ease: null },
      });
    });
  });

  describe("reading", () => {
    it("should give the defaults when nothing is saved", async () => {
      expect(await readReminderSettings()).toEqual(defaultReminderSettings);
    });

    it("should give back what was written", async () => {
      const settings = {
        trainEnabled: true,
        progressEnabled: false,
        easeEnabled: true,
        trainTime: "07:05",
        lastVariant: { train: "train-2", progress: null, ease: "ease-1" },
      };

      await writeReminderSettings(settings);

      expect(await readReminderSettings()).toEqual(settings);
    });

    it("should give the defaults when storage cannot be read", async () => {
      mockGetItem.mockRejectedValueOnce(new Error("storage unavailable"));

      expect(await readReminderSettings()).toEqual(defaultReminderSettings);
    });

    it("should give the defaults when what is saved is not JSON", async () => {
      mockStorageItems.set(reminderSettingsStorageKey, "{not json");

      expect(await readReminderSettings()).toEqual(defaultReminderSettings);
    });

    it("should keep the valid fields and default the rest of a damaged record", async () => {
      mockStorageItems.set(
        reminderSettingsStorageKey,
        JSON.stringify({
          trainEnabled: true,
          progressEnabled: "yes",
          trainTime: "25:99",
          lastVariant: { train: "train-1", progress: 7, ease: "" },
        }),
      );

      expect(await readReminderSettings()).toEqual({
        ...defaultReminderSettings,
        trainEnabled: true,
        lastVariant: { train: "train-1", progress: null, ease: null },
      });
    });
  });

  describe("writing", () => {
    it.each(["25:99", "24:00", "99:00"])(
      "should not save settings whose train time is %s",
      async (trainTime) => {
        await writeReminderSettings({ ...defaultReminderSettings, trainEnabled: true, trainTime });

        expect(mockSetItem).not.toHaveBeenCalled();
      },
    );

    it("should not raise when storage cannot be written", async () => {
      mockSetItem.mockRejectedValueOnce(new Error("storage unavailable"));

      await expect(writeReminderSettings(defaultReminderSettings)).resolves.toBeUndefined();
    });
  });

  describe("useReminderSettings", () => {
    it("should start on the defaults, all off, and show what is saved once it has loaded", async () => {
      const load = holdNextRead();

      const { result } = await renderHook(() => useReminderSettings());

      expect(result.current.settings).toEqual(defaultReminderSettings);
      expect(result.current.isLoaded).toBe(false);
      await act(() => {
        load.finishWith({ ...defaultReminderSettings, easeEnabled: true });
      });
      expect(result.current.isLoaded).toBe(true);
      expect(result.current.settings.easeEnabled).toBe(true);
    });

    it("should keep the defaults and finish loading when storage fails", async () => {
      mockGetItem.mockRejectedValueOnce(new Error("storage unavailable"));

      const { result } = await renderHook(() => useReminderSettings());

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });
      expect(result.current.settings).toEqual(defaultReminderSettings);
    });

    it("should change the given fields, keep the others and save the result", async () => {
      const { result } = await renderHook(() => useReminderSettings());
      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      await act(async () => {
        await result.current.update({ trainEnabled: true, trainTime: "06:45" });
      });

      expect(result.current.settings).toEqual({
        ...defaultReminderSettings,
        trainEnabled: true,
        trainTime: "06:45",
      });
      expect(await readReminderSettings()).toEqual(result.current.settings);
    });

    it("should change a field on top of the saved ones when it is changed before the load has finished", async () => {
      const saved = {
        ...defaultReminderSettings,
        trainEnabled: true,
        progressEnabled: true,
        trainTime: "06:00",
      };
      const load = holdNextRead();
      const { result } = await renderHook(() => useReminderSettings());

      let change: Promise<void> = Promise.resolve();
      await act(() => {
        change = result.current.update({ easeEnabled: true });
      });
      await act(async () => {
        load.finishWith(saved);
        await change;
      });

      const expected = { ...saved, easeEnabled: true };
      expect(result.current.isLoaded).toBe(true);
      expect(result.current.settings).toEqual(expected);
      expect(await readReminderSettings()).toEqual(expected);
    });

    it("should share one set of settings between two instances, and read storage once", async () => {
      const first = await renderHook(() => useReminderSettings());
      const second = await renderHook(() => useReminderSettings());
      await waitFor(() => {
        expect(second.result.current.isLoaded).toBe(true);
      });

      await act(async () => {
        await first.result.current.update({ easeEnabled: true, trainTime: "06:15" });
      });

      expect(second.result.current.settings).toEqual(first.result.current.settings);
      expect(second.result.current.settings.easeEnabled).toBe(true);
      expect(second.result.current.settings.trainTime).toBe("06:15");
      expect(mockGetItem).toHaveBeenCalledTimes(1);
    });

    it("should let an instance mounted later see a change made by one already mounted", async () => {
      const first = await renderHook(() => useReminderSettings());
      await waitFor(() => {
        expect(first.result.current.isLoaded).toBe(true);
      });
      await act(async () => {
        await first.result.current.update({ progressEnabled: true });
      });

      const second = await renderHook(() => useReminderSettings());

      expect(second.result.current.isLoaded).toBe(true);
      expect(second.result.current.settings.progressEnabled).toBe(true);
    });

    it("should read storage again once every instance has unmounted", async () => {
      const first = await renderHook(() => useReminderSettings());
      await waitFor(() => {
        expect(first.result.current.isLoaded).toBe(true);
      });
      await first.unmount();
      mockStorageItems.set(
        reminderSettingsStorageKey,
        JSON.stringify({ ...defaultReminderSettings, trainEnabled: true }),
      );

      const second = await renderHook(() => useReminderSettings());

      await waitFor(() => {
        expect(second.result.current.isLoaded).toBe(true);
      });
      expect(second.result.current.settings.trainEnabled).toBe(true);
      expect(mockGetItem).toHaveBeenCalledTimes(2);
    });

    it.each(["25:99", "24:00", "99:00"])(
      "should ignore a train time of %s, keeping the time it had and applying the other changes",
      async (trainTime) => {
        const { result } = await renderHook(() => useReminderSettings());
        await waitFor(() => {
          expect(result.current.isLoaded).toBe(true);
        });

        await act(async () => {
          await result.current.update({ trainEnabled: true, trainTime });
        });

        expect(result.current.settings.trainTime).toBe("17:30");
        expect(result.current.settings.trainEnabled).toBe(true);
        expect((await readReminderSettings()).trainTime).toBe("17:30");
      },
    );
  });
});
