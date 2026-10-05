import { and, count, eq, gt, isNull } from "drizzle-orm";
import * as schema from "@db/schema";
import type { InsertUser } from "@db/schema";
import { getDb } from "./connection";

export async function findUserById(id: number) {
  const rows = await getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1);
  return rows.at(0);
}

export async function findUserByEmail(email: string) {
  const rows = await getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  return rows.at(0);
}

export async function createUser(data: InsertUser) {
  const [result] = await getDb().insert(schema.users).values(data).$returningId();
  return findUserById(result.id);
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  await getDb().update(schema.users).set({ passwordHash }).where(eq(schema.users.id, userId));
}

export async function createPasswordResetToken(userId: number, tokenHash: string, expiresAt: Date) {
  await getDb().insert(schema.passwordResetTokens).values({ userId, tokenHash, expiresAt });
}

export async function consumePasswordResetToken(tokenHash: string) {
  const token = await getDb().query.passwordResetTokens.findFirst({
    where: and(
      eq(schema.passwordResetTokens.tokenHash, tokenHash),
      isNull(schema.passwordResetTokens.usedAt),
      gt(schema.passwordResetTokens.expiresAt, new Date()),
    ),
  });
  if (!token) return null;
  await getDb().update(schema.passwordResetTokens).set({ usedAt: new Date() }).where(eq(schema.passwordResetTokens.id, token.id));
  return token;
}

// Used to decide whether a newly registering account should be granted the
// platform-operator role. See resolveSignupRole in api/auth-router.ts.
export async function countUsers(): Promise<number> {
  const [row] = await getDb().select({ count: count() }).from(schema.users);
  return row?.count ?? 0;
}
