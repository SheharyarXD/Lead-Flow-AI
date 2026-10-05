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
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { localFileUrl, isLocalFileUrl, fileKeyFromLocalUrl, deleteLocalFile } from "./lib/localStorage";

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

// Recovers the S3 object key from the URL stored in documents.url. The two
// shapes this app writes are the only ones that need handling:
//   custom endpoint (R2/MinIO):  {endpoint}/{bucket}/{key}
//   AWS:                         https://{bucket}.s3.{region}.amazonaws.com/{key}
// Returns null for anything else (e.g. a local-storage URL), so callers fall
// back rather than handing out a signed URL for an object that isn't there.
function s3KeyFromStoredUrl(url: string): string | null {
  if (!s3Bucket) return null;
  try {
    const { pathname } = new URL(url);
    const path = decodeURIComponent(pathname.replace(/^\/+/, ""));
    if (s3Endpoint) {
      const prefix = `${s3Bucket}/`;
      return path.startsWith(prefix) ? path.slice(prefix.length) : null;
    }
    return path || null;
  } catch {
    return null;
  }
}

export const documentRouter = createRouter({
  // Issues a short-lived, signed download URL for one document after checking
  // that the caller actually belongs to the owning organization.
  //
  // Before this, the frontend navigated straight to documents.url — a direct
  // bucket URL. That left only two possibilities, both wrong: a private bucket
  // broke every download, or a public bucket exposed every tenant's uploads to
  // anyone who had or could guess a URL (the key shape is predictable and the
  // organization id is a small integer). Signing here mirrors what the call
  // recording proxy in api/boot.ts already does correctly.
  getDownloadUrl: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const doc = await getDb().query.documents.findFirst({
        where: eq(documents.id, input.id),
      });
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });

      await requireOrganizationMembership(ctx.user.id, doc.organizationId);

      // Local-disk storage is already served through an authenticated route
      // that performs its own membership check, so the stored URL is safe to
      // hand back as-is.
      if (isLocalFileUrl(doc.url)) {
        return { url: doc.url, fileName: doc.fileName, signed: false };
      }

      const key = s3Client && s3Bucket ? s3KeyFromStoredUrl(doc.url) : null;
      if (!key) {
        // Nothing we can sign — most likely a document row created before S3
        // was configured. Returning the stored URL keeps old attachments
        // reachable instead of failing outright.
        return { url: doc.url, fileName: doc.fileName, signed: false };
      }

      const command = new GetObjectCommand({
        Bucket: s3Bucket,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${doc.fileName.replace(/"/g, "")}"`,
      });
      const url = await getSignedUrl(s3Client!, command, { expiresIn: 300 });
      return { url, fileName: doc.fileName, signed: true };
    }),

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

      // Fallback when S3/R2 isn't configured: real local disk storage, not a
      // fake placeholder URL. The frontend's upload code already does a PUT
      // to whatever `uploadUrl` it gets back, so returning a same-origin
      // route here (instead of null) reuses that exact same code path — no
      // frontend changes needed. See api/lib/localStorage.ts for why this
      // replaced the previous data-URL-in-a-TEXT-column approach.
      const uploadUrl = localFileUrl(fileKey);
      return { uploadUrl, fileKey, publicUrl: uploadUrl, simulated: true };
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
      } else if (isLocalFileUrl(doc.url)) {
        await deleteLocalFile(fileKeyFromLocalUrl(doc.url));
      }

      return { success: true };
    }),
});
