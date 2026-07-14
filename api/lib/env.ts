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
  appId: required("APP_ID"),
  appSecret: requiredSecret("APP_SECRET"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
  kimiAuthUrl: required("KIMI_AUTH_URL"),
  kimiOpenUrl: required("KIMI_OPEN_URL"),
  ownerUnionId: process.env.OWNER_UNION_ID ?? "",
};
