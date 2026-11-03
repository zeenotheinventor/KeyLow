import { getRandomBytes } from "expo-crypto";

const NONCE_BYTES = 24;

/** A nonce from the phone's secure random source (`expo-crypto`, already in the app): 48 hex characters. */
export function createNonce(): string {
  return Array.from(getRandomBytes(NONCE_BYTES), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}
