import fs from "fs/promises";
import path from "path";

// Fallback for document storage when no S3/R2 credentials are configured —
// see documentRouter.ts. Writes real files to disk instead of the previous
// behavior (a fake "https://storage.leadflowai.com/mock/..." URL with nothing
// behind it, which the frontend worked around by embedding the file as a
// base64 data: URL directly in the documents.url column). That worked for
// tiny files but documents.url is a plain MySQL TEXT column, capped at 64KB —
// any real file past roughly 48KB (before ~33% base64 inflation) would
// silently fail or truncate on insert. This stores the actual bytes on disk
// and only ever puts a short path in that column, so the 25MB upload limit
// this app already enforces is never at odds with where the file lives.
//
// This is a local/dev-appropriate fallback, not a production storage
// solution — disk contents don't survive a redeploy on most hosts. It exists
// so uploads are genuinely functional before S3/R2 credentials are supplied,
// not to replace them. The real S3 path in documentRouter.ts takes priority
// automatically the moment those credentials are present.
const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");

function resolveSafePath(fileKey: string): string {
  const resolved = path.resolve(UPLOADS_ROOT, fileKey);
  // Defense in depth: fileKey is server-generated (documentRouter builds it
  // from a sanitized filename), but this guarantees a crafted key can never
  // escape the uploads directory regardless.
  if (resolved !== UPLOADS_ROOT && !resolved.startsWith(UPLOADS_ROOT + path.sep)) {
    throw new Error("Invalid file key");
  }
  return resolved;
}

export async function saveLocalFile(fileKey: string, data: Buffer): Promise<void> {
  const target = resolveSafePath(fileKey);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, data);
}

export async function readLocalFile(fileKey: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(resolveSafePath(fileKey));
  } catch {
    return null;
  }
}

export async function deleteLocalFile(fileKey: string): Promise<void> {
  try {
    await fs.unlink(resolveSafePath(fileKey));
  } catch {
    // Already gone, or never existed — fine either way for a delete.
  }
}

const LOCAL_URL_MARKER = "/api/uploads/local/";

// documentRouter.confirmUpload validates `url` with z.string().url(), which
// rejects a bare relative path — so this always returns a fully-qualified URL,
// same convention as the Stripe/Twilio callback URLs elsewhere in this app
// (PUBLIC_URL env var, falling back to localhost for dev).
export function localFileUrl(fileKey: string): string {
  const base = process.env.PUBLIC_URL || "http://localhost:3000";
  return `${base}${LOCAL_URL_MARKER}${fileKey}`;
}

export function isLocalFileUrl(url: string): boolean {
  return url.includes(LOCAL_URL_MARKER);
}

export function fileKeyFromLocalUrl(url: string): string {
  return url.split(LOCAL_URL_MARKER)[1] ?? "";
}
