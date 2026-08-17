ALTER TABLE `conversations` ADD `lastMessageSenderType` enum('customer','agent','ai','system');--> statement-breakpoint
ALTER TABLE `conversations` ADD `noResponseFlaggedAt` timestamp;--> statement-breakpoint
ALTER TABLE `leads` ADD `followUpFlaggedAt` timestamp;