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
        password: z
          .string()
          .min(6, "Password must be at least 6 characters")
          .refine(
            (val) => /[A-Z]/.test(val),
            "Password must contain at least one capital letter",
          )
          .refine(
            (val) => /\d/.test(val),
            "Password must contain at least one number",
          ),
        name: z.string().min(2, "Name must be at least 2 characters"),
        role: z.enum(["admin", "manager", "collector"]).default("admin"),
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
        role: input.role === "admin" ? "admin" : "user",
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
        // Link user as the selected role of the organization
        let memberRole: "owner" | "admin" | "manager" | "member" = "owner";
        if (input.role === "manager") memberRole = "manager";
        if (input.role === "collector") memberRole = "member";

        await addOrganizationMember({
          organizationId: org.id,
          userId: newUser.id,
          role: memberRole,
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
