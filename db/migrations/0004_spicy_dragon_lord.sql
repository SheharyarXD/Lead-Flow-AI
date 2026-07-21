CREATE TABLE `documents` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`organizationId` bigint unsigned NOT NULL,
	`customerId` bigint unsigned,
	`leadId` bigint unsigned,
	`fileName` varchar(255) NOT NULL,
	`url` text NOT NULL,
	`fileSize` int,
	`mimeType` varchar(100),
	`uploadedBy` bigint unsigned,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `calls` MODIFY COLUMN `status` enum('queued','ringing','in_progress','completed','missed','voicemail','failed','busy','no_answer','canceled') NOT NULL DEFAULT 'queued';--> statement-breakpoint
ALTER TABLE `calls` ADD `twilioCallSid` varchar(64);--> statement-breakpoint
ALTER TABLE `calls` ADD `recordingSid` varchar(64);--> statement-breakpoint
ALTER TABLE `calls` ADD CONSTRAINT `calls_twilioCallSid_unique` UNIQUE(`twilioCallSid`);--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_leadId_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_uploadedBy_users_id_fk` FOREIGN KEY (`uploadedBy`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `doc_org_idx` ON `documents` (`organizationId`);--> statement-breakpoint
CREATE INDEX `doc_customer_idx` ON `documents` (`customerId`);--> statement-breakpoint
CREATE INDEX `doc_lead_idx` ON `documents` (`leadId`);