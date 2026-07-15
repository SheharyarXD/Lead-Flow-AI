ALTER TABLE `organizations` ADD `openaiApiKey` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `twilioAccountSid` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `twilioAuthToken` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `twilioPhoneNumber` varchar(50);--> statement-breakpoint
ALTER TABLE `organizations` ADD `smtpHost` varchar(255);--> statement-breakpoint
ALTER TABLE `organizations` ADD `smtpPort` int;--> statement-breakpoint
ALTER TABLE `organizations` ADD `smtpUser` varchar(255);--> statement-breakpoint
ALTER TABLE `organizations` ADD `smtpPass` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `smtpFromEmail` varchar(255);