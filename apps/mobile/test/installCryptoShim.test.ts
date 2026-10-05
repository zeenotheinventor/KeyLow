import { installCryptoShim } from "../lib/installCryptoShim";

const mockNodeSubtle = crypto.subtle;
const mockExpoGetRandomValues = jest.fn<unknown, unknown[]>();
// expo-crypto's digest is native, so jest runs it through Node's SHA-256 instead.
const mockExpoDigest = jest.fn((_algorithm: string, data: BufferSource) =>
  mockNodeSubtle.digest("SHA-256", data),
);

jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  getRandomValues: (...randomValuesArguments: unknown[]) =>
    mockExpoGetRandomValues(...randomValuesArguments),
  digest: (algorithm: string, data: BufferSource) => mockExpoDigest(algorithm, data),
}));

const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");

function setGlobalCrypto(value: unknown): void {
  Object.defineProperty(globalThis, "crypto", { value, configurable: true, writable: true });
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

describe("installCryptoShim", () => {
  beforeEach(() => {
    mockExpoGetRandomValues.mockClear();
    mockExpoDigest.mockClear();
  });

  afterEach(() => {
    if (originalCryptoDescriptor) {
      Object.defineProperty(globalThis, "crypto", originalCryptoDescriptor);
    }
  });

  it("should install the expo-crypto implementation when there is no global crypto", () => {
    setGlobalCrypto(undefined);

    installCryptoShim();
    globalThis.crypto.getRandomValues(new Uint8Array(4));

    expect(mockExpoGetRandomValues).toHaveBeenCalledTimes(1);
  });

  it("should install it when crypto exists without getRandomValues", () => {
    setGlobalCrypto({});

    installCryptoShim();
    globalThis.crypto.getRandomValues(new Uint8Array(4));

    expect(mockExpoGetRandomValues).toHaveBeenCalled();
  });

  it("should leave an existing implementation alone", () => {
    const existingGetRandomValues = jest.fn();
    setGlobalCrypto({ getRandomValues: existingGetRandomValues });

    installCryptoShim();
    globalThis.crypto.getRandomValues(new Uint8Array(4));

    expect(existingGetRandomValues).toHaveBeenCalledTimes(1);
    expect(mockExpoGetRandomValues).not.toHaveBeenCalled();
  });

  describe("subtle.digest", () => {
    const abc = new TextEncoder().encode("abc");
    const abcSha256 = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

    it("should hash with SHA-256 given the algorithm as a string", async () => {
      setGlobalCrypto(undefined);

      installCryptoShim();
      const hash = await globalThis.crypto.subtle.digest("SHA-256", abc);

      expect(toHex(hash)).toBe(abcSha256);
      expect(mockExpoDigest).toHaveBeenCalledWith("SHA-256", abc);
    });

    it("should hash with SHA-256 given the algorithm as an object", async () => {
      setGlobalCrypto({});

      installCryptoShim();
      const hash = await globalThis.crypto.subtle.digest({ name: "SHA-256" }, abc);

      expect(toHex(hash)).toBe(abcSha256);
    });

    it("should reject any algorithm other than SHA-256", async () => {
      setGlobalCrypto({});

      installCryptoShim();

      await expect(globalThis.crypto.subtle.digest("SHA-1", abc)).rejects.toThrow("SHA-1");
      expect(mockExpoDigest).not.toHaveBeenCalled();
    });

    it("should not replace an existing subtle", () => {
      const existingSubtle = { digest: jest.fn() };
      setGlobalCrypto({ getRandomValues: jest.fn(), subtle: existingSubtle });

      installCryptoShim();

      expect(globalThis.crypto.subtle).toBe(existingSubtle);
    });
  });
});
