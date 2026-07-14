import mysql from "mysql2/promise";
import "dotenv/config";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set in .env!");
    process.exit(1);
  }

  console.log("Connecting to database for repair...");
  const connection = await mysql.createConnection(url);

  async function runSql(query: string) {
    try {
      console.log(`Executing: ${query}`);
      await connection.query(query);
      console.log("Success!");
    } catch (err: any) {
      console.warn(`Skipped/Failed: ${err.message || err}`);
    }
  }

  // 1. Rename lowercase tables to camelCase if they exist
  await runSql("RENAME TABLE knowledgebase TO knowledgeBase;");
  await runSql("RENAME TABLE organizationmembers TO organizationMembers;");
  await runSql("RENAME TABLE passwordresettokens TO passwordResetTokens;");

  // 2. Add services column to organizations
  await runSql("ALTER TABLE organizations ADD COLUMN services json DEFAULT NULL;");

  // 3. Add onboardingCompletedAt column to organizations
  await runSql("ALTER TABLE organizations ADD COLUMN onboardingCompletedAt timestamp NULL DEFAULT NULL;");

  // 4. Create passwordResetTokens table if not exists
  await runSql(`
    CREATE TABLE IF NOT EXISTS passwordResetTokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId BIGINT UNSIGNED NOT NULL,
      tokenHash VARCHAR(128) NOT NULL UNIQUE,
      expiresAt TIMESTAMP NOT NULL,
      usedAt TIMESTAMP NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      INDEX reset_user_idx (userId),
      INDEX reset_expiry_idx (expiresAt)
    ) ENGINE=InnoDB;
  `);

  // 5. Add openaiApiKey column to organizations
  await runSql("ALTER TABLE organizations ADD COLUMN openaiApiKey text DEFAULT NULL;");

  console.log("Database repair completed successfully!");
  await connection.end();
  process.exit(0);
}

main();
