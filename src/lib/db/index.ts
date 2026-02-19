import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";

let _db: DrizzleD1Database | null = null;

export function getDb(): DrizzleD1Database {
  if (!_db) {
    const { env } = getCloudflareContext();
    _db = drizzle(env.DB);
  }
  return _db;
}
