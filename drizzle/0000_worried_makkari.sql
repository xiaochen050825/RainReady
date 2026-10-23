CREATE TABLE `route_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `service_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`next_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`object_key` text NOT NULL,
	`updated_at` text NOT NULL
);
