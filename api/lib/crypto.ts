import { scryptSync, randomBytes, timingSafeEqual, createCipheriv, createDecipheriv } from "crypto";
import { env } from "./env";

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

// Reversible encryption for tenant-supplied secrets (Twilio auth tokens, SMTP
// passwords, OpenAI API keys) that must be stored and later used server-side
// to place real calls to those providers — unlike passwords, these cannot be
// one-way hashed. The key is derived from APP_SECRET so no extra config is
// required, and is never sent to or accepted from the client.
const ENCRYPTION_KEY = scryptSync(env.appSecret, "leadflow-secret-store", 32);

export function encryptSecret(plainText: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(cipherText: string): string | null {
  try {
    const [ivHex, authTagHex, dataHex] = cipherText.split(":");
    if (!ivHex || !authTagHex || !dataHex) return null;
    const decipher = createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}
