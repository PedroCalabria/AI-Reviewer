import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Configuration for the Prisma CLI only — migrations, introspection, studio.
 * The running application never reads this: it builds its own client in
 * lib/db.ts and picks a driver adapter from the connection string.
 *
 * The distinction that matters here is pooled versus direct. Neon's pooled
 * endpoint (PgBouncer) is right for the app, which opens and closes short-lived
 * connections from serverless functions. It is wrong for migrations, which need
 * a real session to take advisory locks and run DDL in a transaction. So the
 * CLI is pointed at the direct endpoint when one is available.
 *
 * DATABASE_URL_UNPOOLED is the name Vercel's Neon integration uses, so it is
 * accepted without any extra configuration on a deployment.
 */
const migrationUrl =
  process.env.DIRECT_DATABASE_URL ??
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrationUrl,
  },
});
