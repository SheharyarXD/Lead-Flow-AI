CREATE TABLE `activities` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`organizationId` bigint unsigned NOT NULL,
	`actorId` bigint unsigned,
	`actorType` enum('user','system','ai','customer') NOT NULL DEFAULT 'user',
	`entityType` enum('lead','customer','conversation','call','appointment','task','automation','organization','user') NOT NULL,
	`entityId` bigint unsigned NOT NULL,
	`action` varchar(100) NOT NULL,
	`description` text,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `appointments` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`organizationId` bigint unsigned NOT NULL,
	`customerId` bigint unsigned,
	`leadId` bigint unsigned,
	`title` varchar(500) NOT NULL,
	`description` text,
	`location` varchar(500),
	`startTime` timestamp NOT NULL,
	`endTime` timestamp NOT NULL,
	`status` enum('scheduled','confirmed','in_progress','completed','cancelled','no_show','rescheduled') NOT NULL DEFAULT 'scheduled',
	`type` enum('call','meeting','demo','follow_up','consultation','other') DEFAULT 'meeting',
	`assignedTo` bigint unsigned,
	`notes` text,
	`reminderSent` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `appointments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `automations` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`organizationId` bigint unsigned NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`trigger` enum('lead_created','lead_status_changed','conversation_started','call_completed','appointment_scheduled','task_due','no_response','follow_up_needed','manual') NOT NULL,
	`conditions` json,
	`actions` json,
	`status` enum('active','paused','draft') NOT NULL DEFAULT 'draft',
	`runCount` int DEFAULT 0,
	`lastRunAt` timestamp,
	`createdBy` bigint unsigned,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `automations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `calls` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`organizationId` bigint unsigned NOT NULL,
	`customerId` bigint unsigned,
	`leadId` bigint unsigned,
	`phoneNumber` varchar(50) NOT NULL,
	`direction` enum('inbound','outbound') NOT NULL,
	`status` enum('queued','ringing','in_progress','completed','missed','voicemail','failed','busy','no_answer') NOT NULL DEFAULT 'queued',
	`duration` int,
	`recordingUrl` text,
	`recordingDuration` int,
	`transcript` text,
	`transcriptStatus` enum('pending','processing','completed','failed') DEFAULT 'pending',
	`aiHandled` boolean DEFAULT false,
	`aiSummary` text,
	`userId` bigint unsigned,
	`notes` text,
	`startedAt` timestamp,
	`endedAt` timestamp,
	`cost` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `calls_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`organizationId` bigint unsigned NOT NULL,
	`customerId` bigint unsigned,
	`leadId` bigint unsigned,
	`channel` enum('sms','email','web_chat','phone','ai_chat','whatsapp') NOT NULL,
	`subject` varchar(500),
	`status` enum('open','closed','pending','spam') NOT NULL DEFAULT 'open',
	`priority` enum('low','medium','high','urgent') DEFAULT 'medium',
	`assignedTo` bigint unsigned,
	`aiHandled` boolean DEFAULT false,
	`aiSummary` text,
	`lastMessageAt` timestamp,
	`lastMessagePreview` text,
	`messageCount` int DEFAULT 0,
	`unreadCount` int DEFAULT 0,
	`tags` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`organizationId` bigint unsigned NOT NULL,
	`firstName` varchar(255) NOT NULL,
	`lastName` varchar(255) NOT NULL,
	`email` varchar(320),
	`phone` varchar(50),
	`avatar` text,
	`source` enum('website','phone','sms','email','referral','social','other') DEFAULT 'other',
	`status` enum('active','inactive','archived') NOT NULL DEFAULT 'active',
	`tags` json,
	`notes` text,
	`metadata` json,
	`lastContactAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledgeBase` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`organizationId` bigint unsigned NOT NULL,
	`type` enum('faq','service','pricing','policy','product','script','general') NOT NULL,
	`title` varchar(500) NOT NULL,
	`content` text NOT NULL,
	`category` varchar(255),
	`tags` json,
	`aiEnabled` boolean DEFAULT true,
	`metadata` json,
	`createdBy` bigint unsigned,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `knowledgeBase_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`organizationId` bigint unsigned NOT NULL,
	`customerId` bigint unsigned,
	`firstName` varchar(255) NOT NULL,
	`lastName` varchar(255) NOT NULL,
	`email` varchar(320),
	`phone` varchar(50),
	`company` varchar(255),
	`title` varchar(255),
	`source` enum('ai_call','ai_chat','website_form','phone','sms','email','referral','social_media','paid_ad','event','other') DEFAULT 'other',
	`status` enum('new','contacted','qualified','proposal','negotiation','won','lost','archived') NOT NULL DEFAULT 'new',
	`priority` enum('low','medium','high','urgent') DEFAULT 'medium',
	`estimatedValue` int,
	`assignedTo` bigint unsigned,
	`tags` json,
	`notes` text,
	`customFields` json,
	`lastActivityAt` timestamp,
	`convertedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`conversationId` bigint unsigned NOT NULL,
	`senderType` enum('customer','agent','ai','system') NOT NULL,
	`senderId` bigint unsigned,
	`content` text NOT NULL,
	`contentType` enum('text','html','image','file','audio','video') DEFAULT 'text',
	`attachments` json,
	`metadata` json,
	`isInternalNote` boolean DEFAULT false,
	`editedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organizationMembers` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`organizationId` bigint unsigned NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`role` enum('owner','admin','manager','member') NOT NULL DEFAULT 'member',
	`title` varchar(255),
	`isDefault` boolean DEFAULT false,
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `organizationMembers_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_user_idx` UNIQUE(`organizationId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`industry` varchar(100),
	`website` varchar(500),
	`phone` varchar(50),
	`email` varchar(320),
	`address` text,
	`businessHours` json,
	`timezone` varchar(100) DEFAULT 'America/New_York',
	`logo` text,
	`aiEnabled` boolean DEFAULT true,
	`aiInstructions` text,
	`greetingMessage` text,
	`services` json,
	`onboardingCompletedAt` timestamp,
	`status` enum('active','inactive','suspended') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizations_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `passwordResetTokens` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`tokenHash` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `passwordResetTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `passwordResetTokens_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`organizationId` bigint unsigned NOT NULL,
	`plan` enum('starter','professional','enterprise') NOT NULL,
	`status` enum('trialing','active','past_due','cancelled','paused') NOT NULL DEFAULT 'trialing',
	`stripeCustomerId` varchar(255),
	`stripeSubscriptionId` varchar(255),
	`currentPeriodStart` timestamp,
	`currentPeriodEnd` timestamp,
	`cancelAtPeriodEnd` boolean DEFAULT false,
	`minutesIncluded` int DEFAULT 100,
	`minutesUsed` int DEFAULT 0,
	`leadsLimit` int DEFAULT 100,
	`usersLimit` int DEFAULT 2,
	`features` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sub_org_idx` UNIQUE(`organizationId`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`organizationId` bigint unsigned NOT NULL,
	`customerId` bigint unsigned,
	`leadId` bigint unsigned,
	`title` varchar(500) NOT NULL,
	`description` text,
	`type` enum('follow_up','call','email','meeting','demo','reminder','other') DEFAULT 'follow_up',
	`status` enum('pending','in_progress','completed','cancelled','overdue') NOT NULL DEFAULT 'pending',
	`priority` enum('low','medium','high','urgent') DEFAULT 'medium',
	`assignedTo` bigint unsigned,
	`dueDate` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`unionId` varchar(255),
	`name` varchar(255),
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`avatar` text,
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`lastSignInAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_unionId_unique` UNIQUE(`unionId`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE INDEX `act_org_idx` ON `activities` (`organizationId`);--> statement-breakpoint
CREATE INDEX `act_entity_idx` ON `activities` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `act_created_idx` ON `activities` (`createdAt`);--> statement-breakpoint
CREATE INDEX `appt_org_idx` ON `appointments` (`organizationId`);--> statement-breakpoint
CREATE INDEX `appt_customer_idx` ON `appointments` (`customerId`);--> statement-breakpoint
CREATE INDEX `appt_start_idx` ON `appointments` (`startTime`);--> statement-breakpoint
CREATE INDEX `appt_assigned_idx` ON `appointments` (`assignedTo`);--> statement-breakpoint
CREATE INDEX `auto_org_idx` ON `automations` (`organizationId`);--> statement-breakpoint
CREATE INDEX `auto_trigger_idx` ON `automations` (`trigger`);--> statement-breakpoint
CREATE INDEX `auto_status_idx` ON `automations` (`status`);--> statement-breakpoint
CREATE INDEX `call_org_idx` ON `calls` (`organizationId`);--> statement-breakpoint
CREATE INDEX `call_customer_idx` ON `calls` (`customerId`);--> statement-breakpoint
CREATE INDEX `call_phone_idx` ON `calls` (`phoneNumber`);--> statement-breakpoint
CREATE INDEX `call_status_idx` ON `calls` (`status`);--> statement-breakpoint
CREATE INDEX `call_direction_idx` ON `calls` (`direction`);--> statement-breakpoint
CREATE INDEX `call_created_idx` ON `calls` (`createdAt`);--> statement-breakpoint
CREATE INDEX `conv_org_idx` ON `conversations` (`organizationId`);--> statement-breakpoint
CREATE INDEX `conv_customer_idx` ON `conversations` (`customerId`);--> statement-breakpoint
CREATE INDEX `conv_lead_idx` ON `conversations` (`leadId`);--> statement-breakpoint
CREATE INDEX `conv_status_idx` ON `conversations` (`status`);--> statement-breakpoint
CREATE INDEX `conv_assigned_idx` ON `conversations` (`assignedTo`);--> statement-breakpoint
CREATE INDEX `conv_channel_idx` ON `conversations` (`channel`);--> statement-breakpoint
CREATE INDEX `customer_org_idx` ON `customers` (`organizationId`);--> statement-breakpoint
CREATE INDEX `customer_email_idx` ON `customers` (`email`);--> statement-breakpoint
CREATE INDEX `customer_phone_idx` ON `customers` (`phone`);--> statement-breakpoint
CREATE INDEX `customer_name_idx` ON `customers` (`firstName`,`lastName`);--> statement-breakpoint
CREATE INDEX `kb_org_idx` ON `knowledgeBase` (`organizationId`);--> statement-breakpoint
CREATE INDEX `kb_type_idx` ON `knowledgeBase` (`type`);--> statement-breakpoint
CREATE INDEX `lead_org_idx` ON `leads` (`organizationId`);--> statement-breakpoint
CREATE INDEX `lead_status_idx` ON `leads` (`status`);--> statement-breakpoint
CREATE INDEX `lead_assigned_idx` ON `leads` (`assignedTo`);--> statement-breakpoint
CREATE INDEX `lead_customer_idx` ON `leads` (`customerId`);--> statement-breakpoint
CREATE INDEX `lead_source_idx` ON `leads` (`source`);--> statement-breakpoint
CREATE INDEX `msg_conv_idx` ON `messages` (`conversationId`);--> statement-breakpoint
CREATE INDEX `msg_sender_idx` ON `messages` (`senderId`);--> statement-breakpoint
CREATE INDEX `msg_created_idx` ON `messages` (`createdAt`);--> statement-breakpoint
CREATE INDEX `member_org_idx` ON `organizationMembers` (`organizationId`);--> statement-breakpoint
CREATE INDEX `member_user_idx` ON `organizationMembers` (`userId`);--> statement-breakpoint
CREATE INDEX `org_name_idx` ON `organizations` (`name`);--> statement-breakpoint
CREATE INDEX `reset_user_idx` ON `passwordResetTokens` (`userId`);--> statement-breakpoint
CREATE INDEX `reset_expiry_idx` ON `passwordResetTokens` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `task_org_idx` ON `tasks` (`organizationId`);--> statement-breakpoint
CREATE INDEX `task_assigned_idx` ON `tasks` (`assignedTo`);--> statement-breakpoint
CREATE INDEX `task_status_idx` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `task_due_idx` ON `tasks` (`dueDate`);