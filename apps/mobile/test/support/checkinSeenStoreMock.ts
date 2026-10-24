// An in-memory AsyncStorage for the tests of the check-in motion, so a test can say which check-in this device
// has already seen and read back what the screen wrote.
const stored = new Map<string, string>();
const checkinSeenStorageKey = "program.checkinSeen";

export const asyncStorageMock = {
  getItem: jest.fn((key: string) => Promise.resolve(stored.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    stored.set(key, value);
    return Promise.resolve();
  }),
};

export function resetCheckinSeenStore(): void {
  stored.clear();
  asyncStorageMock.getItem.mockClear();
  asyncStorageMock.setItem.mockClear();
}

/** The date of the newest check-in this device has already shown the motion for. */
export function seeCheckinAsAlreadySeen(checkinDate: string): void {
  stored.set(checkinSeenStorageKey, checkinDate);
}

/** The date the screen stored as seen, or null when it stored none. */
export function storedCheckinDate(): string | null {
  return stored.get(checkinSeenStorageKey) ?? null;
}
