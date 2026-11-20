import {
  notifiedBadgesStorageKey,
  readNotifiedIds,
  rememberNotifiedIds,
  updateNotifiedIds,
} from "./notifiedBadges";

const mockStorageItems = new Map<string, string>();
// A test can hold the next read open, to stand a sign-out in the middle of a save.
let mockHoldNextRead: Promise<void> | null = null;

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: async (key: string) => {
      const hold = mockHoldNextRead;
      mockHoldNextRead = null;
      await hold;
      return mockStorageItems.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      mockStorageItems.set(key, value);
      return Promise.resolve();
    },
  },
}));

describe("notifiedBadges", () => {
  beforeEach(() => {
    mockStorageItems.clear();
    mockHoldNextRead = null;
  });

  it("should read nothing when nothing was saved", async () => {
    expect(await readNotifiedIds("account-a")).toEqual([]);
  });

  it("should add to what was saved without repeating an id", async () => {
    await rememberNotifiedIds("account-a", ["hat-trick"]);
    await rememberNotifiedIds("account-a", ["hat-trick", "first-bite"]);

    expect(await readNotifiedIds("account-a")).toEqual(["hat-trick", "first-bite"]);
  });

  it("should replace the saved ids with what the change returns", async () => {
    await rememberNotifiedIds("account-a", ["hat-trick", "first-bite"]);
    const kept = await updateNotifiedIds("account-a", (saved) =>
      saved.filter((id) => id !== "hat-trick"),
    );

    expect(kept).toEqual(["first-bite"]);
    expect(await readNotifiedIds("account-a")).toEqual(["first-bite"]);
  });

  it("should keep a separate set for each account", async () => {
    await rememberNotifiedIds("account-a", ["hat-trick"]);
    await rememberNotifiedIds("account-b", ["first-bite"]);

    expect(await readNotifiedIds("account-a")).toEqual(["hat-trick"]);
    expect(await readNotifiedIds("account-b")).toEqual(["first-bite"]);
  });

  it("should never put the ids of an account under another one when the account changes mid save", async () => {
    let release = () => {};
    mockHoldNextRead = new Promise((resolve) => {
      release = resolve;
    });

    const saving = rememberNotifiedIds("account-a", ["hat-trick"]);
    // The next account reads its own list while the first account's save is still waiting.
    const nextAccountRead = readNotifiedIds("account-b");
    release();
    await Promise.all([saving, nextAccountRead]);

    expect(await readNotifiedIds("account-b")).toEqual([]);
    expect(mockStorageItems.get(notifiedBadgesStorageKey("account-a"))).toBe('["hat-trick"]');
  });

  it("should keep an id that is remembered while a prune is reading", async () => {
    await rememberNotifiedIds("account-a", ["first-bite"]);
    let release = () => {};
    mockHoldNextRead = new Promise((resolve) => {
      release = resolve;
    });

    const pruning = updateNotifiedIds("account-a", (saved) =>
      saved.filter((id) => id !== "first-bite"),
    );
    const remembering = rememberNotifiedIds("account-a", ["hat-trick"]);
    release();
    await Promise.all([pruning, remembering]);

    expect(await readNotifiedIds("account-a")).toEqual(["hat-trick"]);
  });

  it("should read nothing from a saved value that is not a list of ids", async () => {
    mockStorageItems.set(notifiedBadgesStorageKey("account-a"), '{"a":1}');

    expect(await readNotifiedIds("account-a")).toEqual([]);
  });

  it("should read nothing from a saved value that is not JSON", async () => {
    mockStorageItems.set(notifiedBadgesStorageKey("account-a"), "not json");

    expect(await readNotifiedIds("account-a")).toEqual([]);
  });
});
