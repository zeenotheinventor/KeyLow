import { describe, expect, it } from "vitest";

import {
  stillNotifiedIds,
  unseenBackfilledIdsOf,
  unseenIdsOf,
  withSeen,
} from "../../src/achievements";

const rows = [
  { id: "first-bite", seenAt: null, backfilled: true },
  { id: "home-cook", seenAt: null, backfilled: false },
  { id: "jotter", seenAt: "2026-11-07T09:00:00.000Z", backfilled: true },
  { id: "notebook", seenAt: "2026-11-07T09:00:00.000Z", backfilled: false },
  { id: "centurion", seenAt: null, backfilled: true },
];

describe("unseenIdsOf", () => {
  it("should be every row not yet seen, backfilled or not, in order", () => {
    expect(unseenIdsOf(rows)).toEqual(["first-bite", "home-cook", "centurion"]);
  });

  it("should be empty when every row is seen", () => {
    expect(unseenIdsOf(rows.filter(({ seenAt }) => seenAt !== null))).toEqual([]);
  });
});

describe("unseenBackfilledIdsOf", () => {
  it("should be only the backfilled rows not yet seen", () => {
    expect(unseenBackfilledIdsOf(rows)).toEqual(["first-bite", "centurion"]);
  });
});

describe("withSeen", () => {
  it("should stamp exactly the given ids that are unseen and keep the rest as they were", () => {
    const stamped = withSeen(rows, ["first-bite", "jotter"], "2026-11-19T10:00:00.000Z");

    expect(stamped.map(({ id, seenAt }) => [id, seenAt])).toEqual([
      ["first-bite", "2026-11-19T10:00:00.000Z"],
      ["home-cook", null],
      ["jotter", "2026-11-07T09:00:00.000Z"],
      ["notebook", "2026-11-07T09:00:00.000Z"],
      ["centurion", null],
    ]);
  });

  it("should keep the other fields of a row and leave the given rows alone", () => {
    const stamped = withSeen(rows, ["first-bite"], "2026-11-19T10:00:00.000Z");

    expect(stamped[0]).toEqual({
      id: "first-bite",
      seenAt: "2026-11-19T10:00:00.000Z",
      backfilled: true,
    });
    expect(rows[0]?.seenAt).toBeNull();
  });
});

describe("stillNotifiedIds", () => {
  it("should drop the ids the person has seen and keep the unseen ones", () => {
    expect(stillNotifiedIds(["home-cook", "notebook"], rows)).toEqual(["home-cook"]);
  });

  it("should keep an id no row holds yet", () => {
    expect(stillNotifiedIds(["hat-trick"], rows)).toEqual(["hat-trick"]);
  });
});
