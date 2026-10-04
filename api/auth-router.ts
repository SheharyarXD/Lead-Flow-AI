import * as cookie from "cookie";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { findUserByEmail, createUser, countUsers } from "./queries/users";
import {
  createOrganization,
  addOrganizationMember,
  createSubscription,
} from "./queries/organizations";
import { hashPassword, verifyPassword } from "./lib/crypto";
import { signSessionToken } from "./auth/session";
import { createHash, randomBytes } from "crypto";
import { consumePasswordResetToken, createPasswordResetToken, updateUserPassword } from "./queries/users";
import { PLAN_LIMITS } from "./lib/billing";
import { sendEmail } from "./lib/email";
import { env } from "./lib/env";

const passwordSchema = z.string().min(8, "Password must be at least 8 characters")
  .refine((value) => /[A-Z]/.test(value), "Password must contain at least one capital letter")
  .refine((value) => /\d/.test(value), "Password must contain at least one number");
const hashResetToken = (token: string) => createHash("sha256").update(token).digest("hex");

// Public registration normally creates a plain tenant user. The one exception
// is bootstrapping the platform operator on a brand-new installation, since
// nothing else in the app can ever grant the "admin" role:
//   * ADMIN_EMAIL set  — only that exact address becomes the operator. This is
//     the safe option for a deployment that is publicly reachable before the
//     operator has registered.
//   * ADMIN_EMAIL unset — the very first account to register becomes the
//     operator, so a fresh install is never left with an unreachable admin
//     console. Every subsequent signup is a normal user.
async function resolveSignupRole(email: string): Promise<"user" | "admin"> {
  if (env.adminEmail) {
    return email.toLowerCase() === env.adminEmail ? "admin" : "user";
  }
  return (await countUsers()) === 0 ? "admin" : "user";
}

// Absolute base URL for links we put in outbound mail. Prefers the explicitly
// configured public URL, falling back to the Host header of the request that
// triggered the mail (same convention as organizationRouter's invite links).
function originFromRequest(req: Request): string {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, "");
  const host = req.headers.get("host") || "localhost:3000";
  const proto = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${proto}://${host}`;
}

// The session context carries the full users row, hash included, because
// authenticateRequest loads it to verify the session. Nothing outside the
// server may see that column — strip it at every boundary that returns the
// caller's own account. See api/queries/userColumns.ts.
function toPublicUser<T extends { passwordHash?: string }>(user: T): Omit<T, "passwordHash"> {
  const rest = { ...user };
  delete (rest as { passwordHash?: string }).passwordHash;
  return rest;
}

export const authRouter = createRouter({
  me: authedQuery.query((opts) => toPublicUser(opts.ctx.user)),

  login: publicQuery
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const user = await findUserByEmail(input.email);
      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      const isValid = verifyPassword(input.password, user.passwordHash);
      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      // Generate session JWT
      const token = await signSessionToken({ userId: user.id });

      // Set cookie
      const opts = getSessionCookieOptions(ctx.req.headers);
      ctx.resHeaders.append(
        "set-cookie",
        cookie.serialize(Session.cookieName, token, {
          httpOnly: opts.httpOnly,
          path: opts.path,
          sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
          secure: opts.secure,
          maxAge: Session.maxAgeMs / 1000,
        }),
      );

      return toPublicUser(user);
    }),

  signup: publicQuery
    .input(
      z.object({
        email: z.string().email(),
        password: passwordSchema,
        name: z.string().min(2, "Name must be at least 2 characters"),
      }),
    )
    .mutation(async ({ input }) => {
      const existingUser = await findUserByEmail(input.email);
      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Email is already registered",
        });
      }

      // Hash password and create user
      const passwordHash = hashPassword(input.password);
      const newUser = await createUser({
        email: input.email,
        name: input.name,
        passwordHash,
        avatar: "",
        role: await resolveSignupRole(input.email),
      });

      if (!newUser) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create user account",
        });
      }

      // Create a default workspace/organization for the new user
      const slug = `org-${newUser.id}-${Date.now()}`;
      const org = await createOrganization({
        name: `${input.name}'s Workspace`,
        slug,
        status: "active",
      });

      if (org) {
        await addOrganizationMember({
          organizationId: org.id,
          userId: newUser.id,
          role: "owner",
          isDefault: true,
        });

        // Set up a default subscription plan (pending Stripe checkout)
        await createSubscription({
          organizationId: org.id,
          plan: "professional",
          status: "incomplete",
          minutesUsed: 0,
          features: ["ai_calls", "sms", "email"],
          ...PLAN_LIMITS.professional,
        });
      }

      return { success: true, email: newUser.email };
    }),

  forgotPassword: publicQuery
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input, ctx }) => {
      const user = await findUserByEmail(input.email);
      // Do not reveal whether an email is registered.
      if (!user) return { success: true };
      const rawToken = randomBytes(32).toString("hex");
      await createPasswordResetToken(user.id, hashResetToken(rawToken), new Date(Date.now() + 60 * 60 * 1000));

      // Deliver the token. The reset screen accepts the raw token directly, so
      // the mail carries both the token and a prefilled link. Sent through the
      // platform SMTP configuration rather than any tenant's own — a password
      // reset is an account-level action, not an organization-level one.
      //
      // sendEmail returns a "development_not_sent" marker instead of throwing
      // when SMTP is unconfigured, so a deployment without mail credentials
      // still stores a usable token rather than failing the whole request.
      const resetUrl = `${originFromRequest(ctx.req)}/login?reset_token=${rawToken}`;
      try {
        await sendEmail(
          user.email,
          "Reset your password",
          `Hi ${user.name || "there"},\n\n` +
            `We received a request to reset your password.\n\n` +
            `Reset link: ${resetUrl}\n\n` +
            `Or paste this token into the reset form:\n${rawToken}\n\n` +
            `This link expires in 1 hour. If you didn't request it, you can ignore this email — your password will not change.`
        );
      } catch (error) {
        // Never surface a mail failure to the caller: doing so would reveal
        // that the address is registered. The token is already stored.
        console.error("[auth] Failed to send password reset email:", error);
      }

      return { success: true, ...(env.isProduction ? {} : { resetToken: rawToken }) };
    }),

  resetPassword: publicQuery
    .input(z.object({ token: z.string().min(32), password: passwordSchema }))
    .mutation(async ({ input }) => {
      const reset = await consumePasswordResetToken(hashResetToken(input.token));
      if (!reset) throw new TRPCError({ code: "BAD_REQUEST", message: "Reset token is invalid or expired" });
      await updateUserPassword(reset.userId, hashPassword(input.password));
      return { success: true };
    }),

  logout: authedQuery.mutation(async ({ ctx }) => {
    const opts = getSessionCookieOptions(ctx.req.headers);
    ctx.resHeaders.append(
      "set-cookie",
      cookie.serialize(Session.cookieName, "", {
        httpOnly: opts.httpOnly,
        path: opts.path,
        sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
        secure: opts.secure,
        maxAge: -1,
        expires: new Date(0),
      }),
    );
    return { success: true };
  }),
});
