import { NONCE_MINIMUM_LENGTH, widgetSnapshotSchema } from "@keylow/core/widgets";

import { createInMemoryWidgetBridge } from "./inMemoryWidgetBridge";
import { createSnapshotWriter, snapshotWriterFor } from "./snapshotWriter";
import { NOW, snapshotSource } from "../../test/support/widgetFixtures";

function setUp(bridge = createInMemoryWidgetBridge(), firstNonce = 1) {
  let counter = firstNonce - 1;
  const createNonce = jest.fn(() => `nonce-${String((counter += 1)).padStart(20, "0")}`);
  const writer = createSnapshotWriter({ bridge, createNonce, now: () => NOW });
  return { bridge, createNonce, writer };
}

const nonceOf = async (bridge: ReturnType<typeof createInMemoryWidgetBridge>) => {
  const stored = await bridge.readSnapshot();
  return stored.status === "ready" ? stored.snapshot.nonce : null;
};

describe("the snapshot writer", () => {
  it("should write a snapshot that passes the contract's schema", async () => {
    const { bridge, writer } = setUp();

    await writer.write(snapshotSource());

    const stored = await bridge.readSnapshot();
    expect(stored.status).toBe("ready");
    expect(
      stored.status === "ready" && widgetSnapshotSchema.safeParse(stored.snapshot).success,
    ).toBe(true);
  });

  it("should write a nonce of at least the minimum length", async () => {
    const { bridge, writer } = setUp();

    await writer.write(snapshotSource());

    const stored = await bridge.readSnapshot();
    expect(stored.status === "ready" && stored.snapshot.nonce.length).toBeGreaterThanOrEqual(
      NONCE_MINIMUM_LENGTH,
    );
  });

  it("should ask the widgets to redraw after a write", async () => {
    const { bridge, writer } = setUp();

    await writer.write(snapshotSource());

    expect(bridge.redrawCount()).toBe(1);
  });

  it("should keep the nonce while the data is the same", async () => {
    const { createNonce, writer } = setUp();

    await writer.write(snapshotSource());
    await writer.write(snapshotSource());

    expect(createNonce).toHaveBeenCalledTimes(1);
  });

  it("should make a new nonce when the data changes", async () => {
    const { bridge, writer } = setUp();

    await writer.write(snapshotSource());
    const first = await bridge.readSnapshot();
    await writer.write(snapshotSource({ weightUnit: "lb" }));
    const second = await bridge.readSnapshot();

    expect(first.status === "ready" && second.status === "ready" && first.snapshot.nonce).not.toBe(
      second.status === "ready" && second.snapshot.nonce,
    );
  });

  it("should write nothing when the data does not make a snapshot", async () => {
    const { bridge, writer } = setUp();

    await writer.write(snapshotSource({ today: "2026-12-25" }));

    expect(await bridge.readSnapshot()).toEqual({ status: "no_data" });
    expect(bridge.redrawCount()).toBe(0);
  });

  it("should reuse the stored nonce on the first write after a cold start when the data is the same", async () => {
    const bridge = createInMemoryWidgetBridge();
    await setUp(bridge).writer.write(snapshotSource());
    const storedNonce = await nonceOf(bridge);

    const afterRestart = setUp(bridge, 50);
    await afterRestart.writer.write(snapshotSource());

    expect(await nonceOf(bridge)).toBe(storedNonce);
    expect(afterRestart.createNonce).not.toHaveBeenCalled();
  });

  it("should make a new nonce after a cold start when the data changed", async () => {
    const bridge = createInMemoryWidgetBridge();
    await setUp(bridge).writer.write(snapshotSource());
    const storedNonce = await nonceOf(bridge);

    await setUp(bridge, 50).writer.write(snapshotSource({ weightUnit: "lb" }));

    expect(await nonceOf(bridge)).not.toBe(storedNonce);
  });

  it("should use one nonce for two overlapping writes of the same data", async () => {
    const { bridge, createNonce, writer } = setUp();

    await Promise.all([writer.write(snapshotSource()), writer.write(snapshotSource())]);

    expect(createNonce).toHaveBeenCalledTimes(1);
    expect(await nonceOf(bridge)).toBe("nonce-00000000000000000001");
  });

  it("should take on a nonce that was rotated since its last write", async () => {
    const { bridge, writer } = setUp();
    await writer.write(snapshotSource());

    await writer.rotate();
    await writer.write(snapshotSource());

    expect(await nonceOf(bridge)).toBe("nonce-00000000000000000002");
  });

  it("should not let a write in flight put the old nonce back after a rotation", async () => {
    const memory = createInMemoryWidgetBridge();
    const { writer: first } = setUp(memory);
    await first.write(snapshotSource());
    // The next write reads the stored snapshot slowly, so it is still in flight when the rotation is asked for.
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const slow = {
      ...memory,
      readSnapshot: async () => {
        const stored = await memory.readSnapshot();
        await held;
        return stored;
      },
    };
    const { writer } = setUp(slow, 50);

    const inFlight = writer.write(snapshotSource());
    const rotated = writer.rotate();
    release();
    await Promise.all([inFlight, rotated]);

    expect(await nonceOf(memory)).toBe("nonce-00000000000000000050");
    const afterwards = await memory.readSnapshot();
    expect(afterwards.status === "ready" && afterwards.snapshot.nonce).not.toBe(
      "nonce-00000000000000000001",
    );
  });
});

describe("rotating the nonce", () => {
  it("should store the same snapshot under a fresh nonce and ask for a redraw", async () => {
    const { bridge, writer } = setUp();
    await writer.write(snapshotSource());
    const before = await bridge.readSnapshot();

    await writer.rotate();

    const after = await bridge.readSnapshot();
    expect(after.status === "ready" && after.snapshot).toEqual(
      before.status === "ready" && { ...before.snapshot, nonce: "nonce-00000000000000000002" },
    );
    expect(bridge.redrawCount()).toBe(2);
  });

  it("should do nothing when there is no snapshot", async () => {
    const { bridge, writer } = setUp();

    await writer.rotate();

    expect(await bridge.readSnapshot()).toEqual({ status: "no_data" });
    expect(bridge.redrawCount()).toBe(0);
  });
});

describe("snapshotWriterFor", () => {
  it("should give one writer, and so one chain, for a bridge", () => {
    const bridge = createInMemoryWidgetBridge();

    expect(snapshotWriterFor(bridge)).toBe(snapshotWriterFor(bridge));
    expect(snapshotWriterFor(createInMemoryWidgetBridge())).not.toBe(snapshotWriterFor(bridge));
  });
});
