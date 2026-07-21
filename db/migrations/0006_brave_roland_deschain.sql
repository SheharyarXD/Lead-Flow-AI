CREATE TABLE `stripeEvents` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`stripeEventId` varchar(255) NOT NULL,
	`type` varchar(100) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stripeEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `stripeEvents_stripeEventId_unique` UNIQUE(`stripeEventId`)
);
