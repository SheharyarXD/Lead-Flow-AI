import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

const WEAK_SECRETS = new Set(["dev-secret", "secret", "changeme", "password"]);

function requiredSecret(name: string, minLength = 32): string {
  const value = required(name);
  if (process.env.NODE_ENV === "production" && (value.length < minLength || WEAK_SECRETS.has(value))) {
    throw new Error(`${name} must be set to a strong, unique value (min ${minLength} chars) in production`);
  }
  return value;
}

export const env = {
  // Signs session JWTs and derives the encryption key for tenant-supplied
  // secrets (see api/lib/crypto.ts). Changing it in an existing installation
  // invalidates every session AND makes every stored Twilio/SMTP/OpenAI
  // credential permanently undecryptable — treat it as immutable once set.
  appSecret: requiredSecret("APP_SECRET"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
  // Optional. When set, the account registering with this address is granted
  // the platform-operator role ("admin") instead of a plain tenant user. When
  // it is NOT set, the first account ever registered becomes the operator, so
  // a fresh installation is never left without an administrator — see
  // api/auth-router.ts. Prefer setting it explicitly on a public deployment.
  adminEmail: (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase(),
};
