// Typed by hand because the app has no Node type definitions.
type FakeTest = { path: string };
type ShardOptions = { shardIndex: number; shardCount: number };
type ShardSequencerInstance = {
  shard: (tests: FakeTest[], options: ShardOptions) => FakeTest[];
};
type ShardSequencerClass = new () => ShardSequencerInstance;

const { mkdtempSync, rmSync, writeFileSync } = jest.requireActual<{
  mkdtempSync: (prefix: string) => string;
  rmSync: (path: string, options: { recursive: boolean; force: boolean }) => void;
  writeFileSync: (path: string, contents: string) => void;
}>("node:fs");
const { tmpdir } = jest.requireActual<{ tmpdir: () => string }>("node:os");
const { join } = jest.requireActual<{ join: (...parts: string[]) => string }>("node:path");
const ShardSequencer = jest.requireActual<ShardSequencerClass>("./support/shardSequencer");

// File name to size in bytes. By size, largest first, the order is e, d, b, a, then c and f (level, so by path).
const FILE_SIZES: Record<string, number> = {
  "a.test.ts": 40,
  "b.test.ts": 50,
  "c.test.ts": 30,
  "d.test.ts": 60,
  "e.test.ts": 100,
  "f.test.ts": 30,
};

describe("the size-weighted shard sequencer", () => {
  let directory: string;
  let tests: FakeTest[];

  beforeAll(() => {
    directory = mkdtempSync(join(tmpdir(), "shard-sequencer-"));
    tests = Object.entries(FILE_SIZES).map(([name, size]) => {
      const path = join(directory, name);
      writeFileSync(path, "x".repeat(size));
      return { path };
    });
  });

  afterAll(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  const namesIn = (shardTests: FakeTest[]) =>
    shardTests.map((test) => test.path.slice(directory.length + 1)).sort();

  const shardOf = (shardIndex: number, shardCount = 3, list: FakeTest[] = tests) =>
    new ShardSequencer().shard(list, { shardIndex, shardCount });

  it("should place each file, largest first, in the lightest leg", () => {
    // e (100) goes to leg 1, d (60) to leg 2 and b (50) to leg 3. a (40) goes to leg 3, the lightest at 50,
    // which makes it 90. c (30) goes to leg 2, the lightest at 60, which makes it 90. f (30) finds legs 2
    // and 3 level at 90, and the lower leg number wins.
    expect(namesIn(shardOf(1))).toEqual(["e.test.ts"]);
    expect(namesIn(shardOf(2))).toEqual(["c.test.ts", "d.test.ts", "f.test.ts"]);
    expect(namesIn(shardOf(3))).toEqual(["a.test.ts", "b.test.ts"]);
  });

  it("should put every file in exactly one leg", () => {
    const allLegs = [1, 2, 3].flatMap((shardIndex) => namesIn(shardOf(shardIndex)));

    expect(allLegs.sort()).toEqual(Object.keys(FILE_SIZES).sort());
  });

  it("should give the same split however the files arrive", () => {
    const reversed = [...tests].reverse();

    for (const shardIndex of [1, 2, 3]) {
      expect(namesIn(shardOf(shardIndex, 3, reversed))).toEqual(namesIn(shardOf(shardIndex)));
    }
  });

  it("should give the same split on a second run", () => {
    for (const shardIndex of [1, 2, 3]) {
      expect(namesIn(shardOf(shardIndex))).toEqual(namesIn(shardOf(shardIndex)));
    }
  });

  it("should break a tie in size by path", () => {
    // c and f are both 30 bytes, so c (the earlier path) is placed first, and takes the lighter leg.
    const equalPair = tests.filter((test) => /[cf]\.test\.ts$/.test(test.path)).reverse();

    expect(namesIn(shardOf(1, 2, equalPair))).toEqual(["c.test.ts"]);
    expect(namesIn(shardOf(2, 2, equalPair))).toEqual(["f.test.ts"]);
  });
});
