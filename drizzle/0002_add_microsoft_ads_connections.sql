CREATE TABLE `microsoft_ads_connections` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `account_id` text,
  `account_name` text,
  `customer_id` text,
  `email` text,
  `access_token_encrypted` text,
  `refresh_token_encrypted` text,
  `token_expires_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
