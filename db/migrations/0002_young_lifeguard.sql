DROP INDEX `org_phone_idx` ON `organizations`;--> statement-breakpoint
DROP INDEX `org_email_idx` ON `organizations`;--> statement-breakpoint
ALTER TABLE `organizations` ADD CONSTRAINT `org_phone_idx` UNIQUE(`phone`);--> statement-breakpoint
ALTER TABLE `organizations` ADD CONSTRAINT `org_email_idx` UNIQUE(`email`);