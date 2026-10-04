ALTER TABLE `subscriptions` ADD `trialEndsAt` timestamp;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `cancellationReason` varchar(255);--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `cancelledAt` timestamp;--> statement-breakpoint
ALTER TABLE `subscriptions` MODIFY COLUMN `status` enum('trialing','active','past_due','cancelled','paused','incomplete') NOT NULL DEFAULT 'incomplete';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `cancellationSurveys` (
	`id` serial PRIMARY KEY,
	`organizationId` bigint unsigned NOT NULL,
	`userId` bigint unsigned,
	`stripeSubscriptionId` varchar(255),
	`stripeCustomerId` varchar(255),
	`reason` varchar(255) NOT NULL,
	`reasonDetails` text,
	`whatCouldBeBetter` text,
	`missingFeatureExpected` text,
	`likelihoodToReturn` varchar(50),
	`additionalComments` text,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `cancellationSurveys_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade,
	CONSTRAINT `cancellationSurveys_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null
);--> statement-breakpoint
CREATE INDEX `cancel_survey_org_idx` ON `cancellationSurveys` (`organizationId`);--> statement-breakpoint
CREATE INDEX `cancel_survey_user_idx` ON `cancellationSurveys` (`userId`);

