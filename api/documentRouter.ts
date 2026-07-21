import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import { eq, and, desc } from "drizzle-orm";
import { documents, activities } from "@db/schema";
import { getDb } from "./queries/connection";
import {
  requireOnboardedOrganizationMembership as requireOrganizationMembership,
  requireOnboardedOrganizationRole as requireOrganizationRole,
} from "./queries/organizations";
import { MAX_UPLOAD_BYTES, isAllowedUploadMimeType } from "./lib/uploads";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Bucket = process.env.S3_BUCKET;
const s3Region = process.env.S3_REGION || "us-east-1";
const s3AccessKey = process.env.S3_ACCESS_KEY_ID;
const s3SecretKey = process.env.S3_SECRET_ACCESS_KEY;
const s3Endpoint = process.env.S3_ENDPOINT;

let s3Client: S3Client | null = null;
if (s3AccessKey && s3SecretKey) {
  s3Client = new S3Client({
    region: s3Region,
    credentials: {
      accessKeyId: s3AccessKey,
      secretAccessKey: s3SecretKey,
    },
    ...(s3Endpoint ? { endpoint: s3Endpoint } : {}),
  });
}

export const documentRouter = createRouter({
  getPresignedUploadUrl: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        fileName: z.string().min(1),
        mimeType: z.string().optional(),
        fileSize: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireOrganizationMembership(ctx.user.id, input.organizationId);

      if (input.fileSize !== undefined && input.fileSize > MAX_UPLOAD_BYTES) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `File exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB upload limit` });
      }
      if (!input.mimeType || !isAllowedUploadMimeType(input.mimeType)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This file type is not allowed" });
      }

      const fileKey = `orgs/${input.organizationId}/${Date.now()}-${input.fileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

      if (s3Client && s3Bucket) {
        const command = new PutObjectCommand({
          Bucket: s3Bucket,
          Key: fileKey,
          ContentType: input.mimeType || "application/octet-stream",
        });
        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        const publicUrl = s3Endpoint
          ? `${s3Endpoint}/${s3Bucket}/${fileKey}`
          : `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/${fileKey}`;

        return { uploadUrl, fileKey, publicUrl, simulated: false };
      }

      // Development fallback when S3 is not configured
      const simulatedUrl = `https://storage.leadflowai.com/mock/${fileKey}`;
      return { uploadUrl: null, fileKey, publicUrl: simulatedUrl, simulated: true };
    }),

  confirmUpload: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        fileName: z.string().min(1),
        url: z.string().url(),
        fileSize: z.number().optional(),
        mimeType: z.string().optional(),
        customerId: z.number().optional(),
        leadId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireOrganizationRole(ctx.user.id, input.organizationId, ["owner", "admin", "manager", "member"]);

      if (input.fileSize !== undefined && input.fileSize > MAX_UPLOAD_BYTES) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `File exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB upload limit` });
      }
      if (!input.mimeType || !isAllowedUploadMimeType(input.mimeType)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This file type is not allowed" });
      }

      const db = getDb();

      const [inserted] = await db.insert(documents).values({
        organizationId: input.organizationId,
        customerId: input.customerId || null,
        leadId: input.leadId || null,
        fileName: input.fileName,
        url: input.url,
        fileSize: input.fileSize || null,
        mimeType: input.mimeType || null,
        uploadedBy: ctx.user.id,
      });

      // Audit activity log
      await db.insert(activities).values({
        organizationId: input.organizationId,
        actorId: ctx.user.id,
        actorType: "user",
        entityType: input.leadId ? "lead" : "customer",
        entityId: input.leadId || input.customerId || input.organizationId,
        action: "Document Uploaded",
        description: `Uploaded file: ${input.fileName}`,
      });

      return inserted;
    }),

  list: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        customerId: z.number().optional(),
        leadId: z.number().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      await requireOrganizationMembership(ctx.user.id, input.organizationId);
      const db = getDb();

      const conditions = [eq(documents.organizationId, input.organizationId)];
      if (input.customerId) conditions.push(eq(documents.customerId, input.customerId));
      if (input.leadId) conditions.push(eq(documents.leadId, input.leadId));

      return db.query.documents.findMany({
        where: and(...conditions),
        orderBy: [desc(documents.createdAt)],
      });
    }),

  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const doc = await db.query.documents.findFirst({
        where: eq(documents.id, input.id),
      });

      if (!doc) throw new Error("Document not found");
      await requireOrganizationRole(ctx.user.id, doc.organizationId, ["owner", "admin", "manager"]);

      await db.delete(documents).where(eq(documents.id, input.id));

      // Attempt S3 delete if object URL matches bucket pattern
      if (s3Client && s3Bucket && doc.url.includes(s3Bucket)) {
        try {
          const key = doc.url.split(`${s3Bucket}/`)[1];
          if (key) {
            await s3Client.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: key }));
          }
        } catch (e) {
          console.warn("Failed to delete object from S3 bucket:", e);
        }
      }

      return { success: true };
    }),
});
