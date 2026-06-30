import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

/**
 * Hash a password using Node's native scryptSync algorithm.
 * Returns a string formatted as "salt:hash".
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  // 64-byte key length is standard for secure password derivation
  const derivedKey = scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verify a password against a salt:hash string.
 */
export function verifyPassword(password: string, hash: string): boolean {
  try {
    const [salt, keyHex] = hash.split(":");
    if (!salt || !keyHex) return false;

    const keyBuffer = Buffer.from(keyHex, "hex");
    const derivedKey = scryptSync(password, salt, keyBuffer.length);

    return timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}
