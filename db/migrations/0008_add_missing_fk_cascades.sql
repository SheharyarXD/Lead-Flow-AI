-- db/schema.ts declares an onDelete behavior on every foreign key via
-- .references(() => x.id, { onDelete: ... }), but this database's tables were
-- built up through an ad-hoc repair script (db/repair.ts) rather than real
-- migrations, so most of those constraints were never actually applied at the
-- MySQL level. Only organizationInvitations had real FKs. That meant deleting
-- an organization, lead, or customer left orphaned rows behind indefinitely in
-- every other related table instead of cascading or nulling out as intended.
--
-- This migration is idempotent by construction: every ADD CONSTRAINT is guarded
-- by a check against information_schema.TABLE_CONSTRAINTS first, so it is safe
-- to run against a fresh database (nothing exists yet, everything gets added),
-- this database (most already exist from the prior ad-hoc fix, only the missing
-- one gets added), or an already-fully-migrated database (pure no-op). MySQL has
-- no native "ADD CONSTRAINT IF NOT EXISTS", so the guard is done manually via
-- PREPARE/EXECUTE on a conditionally-built statement.
--
-- Design: CASCADE vs SET NULL
-- ----------------------------
-- CASCADE is used only where the child row has no independent meaning without
-- its parent:
--   * every *.organizationId -> organizations.id (the multi-tenant root — once
--     the business itself is gone, nothing scoped to it makes sense to keep)
--   * organizationMembers.userId -> users.id (a membership row is meaningless
--     without either side)
--   * messages.conversationId -> conversations.id (a message cannot exist
--     outside the thread it belongs to)
--   * passwordResetTokens.userId -> users.id (a reset token for a deleted
--     account is dead weight, not data worth keeping)
--   * subscriptions.organizationId -> organizations.id — this is the one that
--     looks like "billing records" at a glance, but it isn't: Stripe is the
--     system of record for actual invoices/payment history, this table is only
--     the local mirror of an org's current plan/limits. Deleting the org means
--     there is nothing left to bill against, so cascading it away is correct
--     and doesn't destroy any authoritative financial record.
--
-- SET NULL is used everywhere a column is a soft "who/what this relates to"
-- reference rather than true ownership — leads/conversations/calls/
-- appointments/tasks/documents linking to customerId or leadId, and the
-- assignedTo/userId/createdBy/uploadedBy/invitedBy columns linking to users.
-- A call log, task, or document is a real business record on its own; deleting
-- the customer, lead, or staff account it happened to reference shouldn't
-- retroactively erase that history — it should just drop the now-invalid link.
--
-- RESTRICT was considered and rejected everywhere: the one place it could
-- plausibly apply (e.g. blocking deletion of an organization that still has an
-- active paid subscription) is a business rule, not a data-integrity one — it
-- belongs as an application-level confirmation/guard (organizationRouter),
-- not a raw DB error surfaced straight to a user.

-- One-time cleanup: null out any pre-existing orphaned references before their
-- constraint is added — MySQL refuses to add a FK constraint while rows already
-- violate it. A full scan of every relationship below found exactly one
-- orphan: tasks.leadId pointing at a lead deleted before this repair existed.
-- This restores the row to the same state SET NULL would have left it in had
-- the constraint existed at the time, and touches nothing else.
UPDATE `tasks` t
LEFT JOIN `leads` l ON t.`leadId` = l.`id`
SET t.`leadId` = NULL
WHERE t.`leadId` IS NOT NULL AND l.`id` IS NULL;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_reset_user');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `passwordResetTokens` ADD CONSTRAINT `fk_reset_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_member_org');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `organizationMembers` ADD CONSTRAINT `fk_member_org` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_member_user');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `organizationMembers` ADD CONSTRAINT `fk_member_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_invite_org');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `organizationInvitations` ADD CONSTRAINT `fk_invite_org` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_invite_user');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `organizationInvitations` ADD CONSTRAINT `fk_invite_user` FOREIGN KEY (`invitedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_customer_org');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `customers` ADD CONSTRAINT `fk_customer_org` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_lead_org');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `leads` ADD CONSTRAINT `fk_lead_org` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_lead_customer');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `leads` ADD CONSTRAINT `fk_lead_customer` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE SET NULL', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_lead_assigned');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `leads` ADD CONSTRAINT `fk_lead_assigned` FOREIGN KEY (`assignedTo`) REFERENCES `users`(`id`) ON DELETE SET NULL', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_conv_org');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `conversations` ADD CONSTRAINT `fk_conv_org` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_conv_customer');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `conversations` ADD CONSTRAINT `fk_conv_customer` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE SET NULL', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_conv_lead');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `conversations` ADD CONSTRAINT `fk_conv_lead` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE SET NULL', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_conv_assigned');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `conversations` ADD CONSTRAINT `fk_conv_assigned` FOREIGN KEY (`assignedTo`) REFERENCES `users`(`id`) ON DELETE SET NULL', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_message_conv');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `messages` ADD CONSTRAINT `fk_message_conv` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE CASCADE', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_call_org');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `calls` ADD CONSTRAINT `fk_call_org` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_call_customer');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `calls` ADD CONSTRAINT `fk_call_customer` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE SET NULL', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_call_lead');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `calls` ADD CONSTRAINT `fk_call_lead` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE SET NULL', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_call_user');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `calls` ADD CONSTRAINT `fk_call_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_appt_org');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `appointments` ADD CONSTRAINT `fk_appt_org` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_appt_customer');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `appointments` ADD CONSTRAINT `fk_appt_customer` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE SET NULL', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_appt_lead');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `appointments` ADD CONSTRAINT `fk_appt_lead` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE SET NULL', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_appt_assigned');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `appointments` ADD CONSTRAINT `fk_appt_assigned` FOREIGN KEY (`assignedTo`) REFERENCES `users`(`id`) ON DELETE SET NULL', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_task_org');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `tasks` ADD CONSTRAINT `fk_task_org` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_task_customer');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `tasks` ADD CONSTRAINT `fk_task_customer` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE SET NULL', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_task_lead');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `tasks` ADD CONSTRAINT `fk_task_lead` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE SET NULL', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_task_assigned');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `tasks` ADD CONSTRAINT `fk_task_assigned` FOREIGN KEY (`assignedTo`) REFERENCES `users`(`id`) ON DELETE SET NULL', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_automation_org');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `automations` ADD CONSTRAINT `fk_automation_org` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_automation_creator');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `automations` ADD CONSTRAINT `fk_automation_creator` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE SET NULL', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_sub_org');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `subscriptions` ADD CONSTRAINT `fk_sub_org` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_kb_org');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `knowledgeBase` ADD CONSTRAINT `fk_kb_org` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_kb_creator');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `knowledgeBase` ADD CONSTRAINT `fk_kb_creator` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE SET NULL', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_activity_org');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `activities` ADD CONSTRAINT `fk_activity_org` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_doc_org');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `documents` ADD CONSTRAINT `fk_doc_org` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_doc_customer');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `documents` ADD CONSTRAINT `fk_doc_customer` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE SET NULL', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_doc_lead');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `documents` ADD CONSTRAINT `fk_doc_lead` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE SET NULL', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
--> statement-breakpoint

SET @exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_doc_uploader');
--> statement-breakpoint
SET @ddl = IF(@exists = 0, 'ALTER TABLE `documents` ADD CONSTRAINT `fk_doc_uploader` FOREIGN KEY (`uploadedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL', 'SELECT 1');
--> statement-breakpoint
PREPARE stmt FROM @ddl;
--> statement-breakpoint
EXECUTE stmt;
--> statement-breakpoint
DEALLOCATE PREPARE stmt;
