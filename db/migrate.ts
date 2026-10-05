import "dotenv/config";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";

// Production migration runner, bundled into dist/ alongside the server.
//
// `npm run db:migrate` (drizzle-kit) is the right command locally, but
// drizzle-kit is a devDependency — relying on it at container start means the
// deploy breaks the moment the platform prunes dev dependencies. drizzle-orm's
// own migrator is a runtime dependency, so bundling this keeps the release
// step working regardless of how the host installs packages.
//
// Applying migrations is idempotent: already-applied entries are recorded in
// __drizzle_migrations and skipped, so this is safe to run on every boot.
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[migrate] DATABASE_URL is not set.");
    process.exit(1);
  }

  console.log("[migrate] Connecting...");
  // multipleStatements stays off: every migration file is split into single
  // statements, and migration 0008 relies on session variables persisting
  // across them on one connection, which a single connection already gives us.
  const connection = await mysql.createConnection(url);

  try {
    const db = drizzle(connection);
    await migrate(db, { migrationsFolder: "./db/migrations" });
    console.log("[migrate] Schema is up to date.");
  } catch (error) {
    console.error("[migrate] Migration failed:", error);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

main();
