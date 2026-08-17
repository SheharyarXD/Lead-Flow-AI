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

  // 6. Add Twilio and SMTP settings columns to organizations
  await runSql("ALTER TABLE organizations ADD COLUMN twilioAccountSid text DEFAULT NULL;");
  await runSql("ALTER TABLE organizations ADD COLUMN twilioAuthToken text DEFAULT NULL;");
  await runSql("ALTER TABLE organizations ADD COLUMN twilioPhoneNumber varchar(50) DEFAULT NULL;");
  await runSql("ALTER TABLE organizations ADD COLUMN twilioTwimlAppSid varchar(64) DEFAULT NULL;");
  await runSql("ALTER TABLE organizations ADD COLUMN smtpHost varchar(255) DEFAULT NULL;");
  await runSql("ALTER TABLE organizations ADD COLUMN smtpPort int DEFAULT NULL;");
  await runSql("ALTER TABLE organizations ADD COLUMN smtpUser varchar(255) DEFAULT NULL;");
  await runSql("ALTER TABLE organizations ADD COLUMN smtpPass text DEFAULT NULL;");
  await runSql("ALTER TABLE organizations ADD COLUMN smtpFromEmail varchar(255) DEFAULT NULL;");

  // 7. Create documents table if not exists
  await runSql(`
    CREATE TABLE IF NOT EXISTS documents (
      id INT AUTO_INCREMENT PRIMARY KEY,
      organizationId BIGINT UNSIGNED NOT NULL,
      customerId BIGINT UNSIGNED NULL,
      leadId BIGINT UNSIGNED NULL,
      fileName VARCHAR(255) NOT NULL,
      url TEXT NOT NULL,
      fileSize INT NULL,
      mimeType VARCHAR(100) NULL,
      uploadedBy BIGINT UNSIGNED NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      INDEX doc_org_idx (organizationId),
      INDEX doc_customer_idx (customerId),
      INDEX doc_lead_idx (leadId)
    ) ENGINE=InnoDB;
  `);

  // 8. Create stripeEvents table if not exists
  await runSql(`
    CREATE TABLE IF NOT EXISTS stripeEvents (
      id INT AUTO_INCREMENT PRIMARY KEY,
      stripeEventId VARCHAR(255) NOT NULL UNIQUE,
      type VARCHAR(100) NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    ) ENGINE=InnoDB;
  `);

  // 9. Add missing columns to calls table
  await runSql("ALTER TABLE calls ADD COLUMN twilioCallSid varchar(64) DEFAULT NULL;");
  await runSql("ALTER TABLE calls ADD COLUMN recordingSid varchar(64) DEFAULT NULL;");
  await runSql("ALTER TABLE calls ADD UNIQUE INDEX calls_twilioCallSid_unique (twilioCallSid);");
  await runSql("ALTER TABLE calls MODIFY COLUMN status enum('queued','ringing','in_progress','completed','missed','voicemail','failed','busy','no_answer','canceled') NOT NULL DEFAULT 'queued';");

  // 10. Create organizationInvitations table if not exists
  await runSql(`
    CREATE TABLE IF NOT EXISTS organizationInvitations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      organizationId BIGINT UNSIGNED NOT NULL,
      email VARCHAR(320) NOT NULL,
      role ENUM('admin','manager','member') NOT NULL DEFAULT 'member',
      tokenHash VARCHAR(128) NOT NULL UNIQUE,
      status ENUM('pending','accepted','revoked','expired') NOT NULL DEFAULT 'pending',
      invitedBy BIGINT UNSIGNED NULL,
      expiresAt TIMESTAMP NOT NULL,
      acceptedAt TIMESTAMP NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      INDEX invite_org_idx (organizationId),
      INDEX invite_email_idx (email),
      INDEX invite_status_idx (status),
      CONSTRAINT fk_invite_org FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE,
      CONSTRAINT fk_invite_user FOREIGN KEY (invitedBy) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB;
  `);

  // 11. Add discount snapshot columns to subscriptions (promotion code support)
  await runSql("ALTER TABLE subscriptions ADD COLUMN discountSummary varchar(255) DEFAULT NULL;");
  await runSql("ALTER TABLE subscriptions ADD COLUMN discountEndsAt timestamp NULL DEFAULT NULL;");

  // 12. Add the foreign key constraints db/schema.ts already declares via
  // .references(...) but that were never actually applied to this database —
  // it was built up entirely through the ad-hoc ALTER/CREATE statements above
  // rather than a real migration, so only organizationInvitations (added with
  // explicit CONSTRAINT clauses in step 10) ever got real FKs. Every other
  // organization-scoped table was silently missing them, which let deleting an
  // organization/lead/customer leave orphaned rows behind indefinitely instead
  // of cascading. These match schema.ts's onDelete behavior exactly — CASCADE
  // where the child row makes no sense without its parent, SET NULL where the
  // relation is just a reference (e.g. "assigned to this now-deleted user").
  await runSql("ALTER TABLE passwordResetTokens ADD CONSTRAINT fk_reset_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE;");

  await runSql("ALTER TABLE organizationMembers ADD CONSTRAINT fk_member_org FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE;");
  await runSql("ALTER TABLE organizationMembers ADD CONSTRAINT fk_member_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE;");

  await runSql("ALTER TABLE customers ADD CONSTRAINT fk_customer_org FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE;");

  await runSql("ALTER TABLE leads ADD CONSTRAINT fk_lead_org FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE;");
  await runSql("ALTER TABLE leads ADD CONSTRAINT fk_lead_customer FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE SET NULL;");
  await runSql("ALTER TABLE leads ADD CONSTRAINT fk_lead_assigned FOREIGN KEY (assignedTo) REFERENCES users(id) ON DELETE SET NULL;");

  await runSql("ALTER TABLE conversations ADD CONSTRAINT fk_conv_org FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE;");
  await runSql("ALTER TABLE conversations ADD CONSTRAINT fk_conv_customer FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE SET NULL;");
  await runSql("ALTER TABLE conversations ADD CONSTRAINT fk_conv_lead FOREIGN KEY (leadId) REFERENCES leads(id) ON DELETE SET NULL;");
  await runSql("ALTER TABLE conversations ADD CONSTRAINT fk_conv_assigned FOREIGN KEY (assignedTo) REFERENCES users(id) ON DELETE SET NULL;");

  await runSql("ALTER TABLE messages ADD CONSTRAINT fk_message_conv FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE;");

  await runSql("ALTER TABLE calls ADD CONSTRAINT fk_call_org FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE;");
  await runSql("ALTER TABLE calls ADD CONSTRAINT fk_call_customer FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE SET NULL;");
  await runSql("ALTER TABLE calls ADD CONSTRAINT fk_call_lead FOREIGN KEY (leadId) REFERENCES leads(id) ON DELETE SET NULL;");
  await runSql("ALTER TABLE calls ADD CONSTRAINT fk_call_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL;");

  await runSql("ALTER TABLE appointments ADD CONSTRAINT fk_appt_org FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE;");
  await runSql("ALTER TABLE appointments ADD CONSTRAINT fk_appt_customer FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE SET NULL;");
  await runSql("ALTER TABLE appointments ADD CONSTRAINT fk_appt_lead FOREIGN KEY (leadId) REFERENCES leads(id) ON DELETE SET NULL;");
  await runSql("ALTER TABLE appointments ADD CONSTRAINT fk_appt_assigned FOREIGN KEY (assignedTo) REFERENCES users(id) ON DELETE SET NULL;");

  await runSql("ALTER TABLE tasks ADD CONSTRAINT fk_task_org FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE;");
  await runSql("ALTER TABLE tasks ADD CONSTRAINT fk_task_customer FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE SET NULL;");
  await runSql("ALTER TABLE tasks ADD CONSTRAINT fk_task_lead FOREIGN KEY (leadId) REFERENCES leads(id) ON DELETE SET NULL;");
  await runSql("ALTER TABLE tasks ADD CONSTRAINT fk_task_assigned FOREIGN KEY (assignedTo) REFERENCES users(id) ON DELETE SET NULL;");

  await runSql("ALTER TABLE automations ADD CONSTRAINT fk_automation_org FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE;");
  await runSql("ALTER TABLE automations ADD CONSTRAINT fk_automation_creator FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE SET NULL;");

  await runSql("ALTER TABLE subscriptions ADD CONSTRAINT fk_sub_org FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE;");

  await runSql("ALTER TABLE knowledgeBase ADD CONSTRAINT fk_kb_org FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE;");
  await runSql("ALTER TABLE knowledgeBase ADD CONSTRAINT fk_kb_creator FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE SET NULL;");

  await runSql("ALTER TABLE activities ADD CONSTRAINT fk_activity_org FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE;");

  await runSql("ALTER TABLE documents ADD CONSTRAINT fk_doc_org FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE;");
  await runSql("ALTER TABLE documents ADD CONSTRAINT fk_doc_customer FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE SET NULL;");
  await runSql("ALTER TABLE documents ADD CONSTRAINT fk_doc_lead FOREIGN KEY (leadId) REFERENCES leads(id) ON DELETE SET NULL;");
  await runSql("ALTER TABLE documents ADD CONSTRAINT fk_doc_uploader FOREIGN KEY (uploadedBy) REFERENCES users(id) ON DELETE SET NULL;");

  console.log("Database repair completed successfully!");
  await connection.end();
  process.exit(0);
}

main();
