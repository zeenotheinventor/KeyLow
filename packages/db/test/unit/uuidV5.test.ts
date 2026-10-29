import { describe, expect, it } from "vitest";

import { uuidV5 } from "../../scripts/uuidV5";

describe("uuidV5", () => {
  it("should match the RFC 9562 example: the DNS namespace and www.example.com", () => {
    // The value Python's uuid.uuid5(uuid.NAMESPACE_DNS, "www.example.com") gives.
    expect(uuidV5("6ba7b810-9dad-11d1-80b4-00c04fd430c8", "www.example.com")).toBe(
      "2ed6657d-e927-568b-95e1-2665a8aea6a2",
    );
  });
});
