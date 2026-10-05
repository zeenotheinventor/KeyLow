import { CryptoDigestAlgorithm, digest, getRandomValues } from "expo-crypto";

// Typed as optional because some runtimes, Hermes among them, have no global crypto at all.
function readGlobalCrypto(): Partial<Crypto> | undefined {
  return globalThis.crypto;
}

function ensureGlobalCrypto(): Partial<Crypto> {
  const existingCrypto = readGlobalCrypto();
  if (existingCrypto !== undefined) {
    return existingCrypto;
  }

  const createdCrypto: Partial<Crypto> = {};
  Object.defineProperty(globalThis, "crypto", {
    value: createdCrypto,
    configurable: true,
    writable: true,
  });
  return createdCrypto;
}

function defineWhenMissing(
  target: Partial<Crypto>,
  name: "getRandomValues" | "subtle",
  value: unknown,
) {
  if (target[name] === undefined) {
    Object.defineProperty(target, name, { value, configurable: true, writable: true });
  }
}

// auth-js only ever asks for SHA-256, to build the PKCE S256 code challenge.
const subtle = {
  digest(algorithm: AlgorithmIdentifier, data: BufferSource): Promise<ArrayBuffer> {
    const name = typeof algorithm === "string" ? algorithm : algorithm.name;

    if (name.toUpperCase() !== "SHA-256") {
      return Promise.reject(
        new Error(`Unsupported digest algorithm ${name}, only SHA-256 is available`),
      );
    }

    return digest(CryptoDigestAlgorithm.SHA256, data);
  },
};

/**
 * Hermes defines no global crypto. Without it auth-js builds its PKCE verifier from Math.random
 * and falls back to a plain code challenge. This installs a secure getRandomValues and a SHA-256
 * subtle.digest, each only when the runtime has none.
 */
export function installCryptoShim(): void {
  const globalCrypto = ensureGlobalCrypto();

  defineWhenMissing(globalCrypto, "getRandomValues", getRandomValues);
  defineWhenMissing(globalCrypto, "subtle", subtle);
}
