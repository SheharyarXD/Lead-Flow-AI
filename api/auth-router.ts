import * as cookie from "cookie";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { findUserByEmail, createUser } from "./queries/users";
import {
  createOrganization,
  addOrganizationMember,
  createSubscription,
} from "./queries/organizations";
import { hashPassword, verifyPassword } from "./lib/crypto";
import { signSessionToken } from "./kimi/session";
import { createHash, randomBytes } from "crypto";
import { consumePasswordResetToken, createPasswordResetToken, updateUserPassword } from "./queries/users";

const passwordSchema = z.string().min(8, "Password must be at least 8 characters")
  .refine((value) => /[A-Z]/.test(value), "Password must contain at least one capital letter")
  .refine((value) => /\d/.test(value), "Password must contain at least one number");
const hashResetToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const authRouter = createRouter({
  me: authedQuery.query((opts) => opts.ctx.user),

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

      return user;
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
        // Public registration can only create a standard platform user.
        role: "user",
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

        // Set up a default subscription plan
        await createSubscription({
          organizationId: org.id,
          plan: "starter",
          status: "active",
          minutesIncluded: 100,
          minutesUsed: 0,
          leadsLimit: 100,
          usersLimit: 2,
          features: ["ai_calls", "sms", "email"],
        });
      }

      return { success: true, email: newUser.email };
    }),

  forgotPassword: publicQuery
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const user = await findUserByEmail(input.email);
      // Do not reveal whether an email is registered.
      if (!user) return { success: true };
      const rawToken = randomBytes(32).toString("hex");
      await createPasswordResetToken(user.id, hashResetToken(rawToken), new Date(Date.now() + 60 * 60 * 1000));
      // A mail delivery implementation can consume this value. It is intentionally
      // exposed only outside production to support a basic local MVP reset flow.
      return { success: true, ...(process.env.NODE_ENV !== "production" ? { resetToken: rawToken } : {}) };
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
