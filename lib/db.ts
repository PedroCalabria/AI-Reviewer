import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

/**
 * One Prisma client for the process.
 *
 * Prisma 7 talks to the database through a driver adapter rather than a bundled
 * engine, so the adapter is chosen here from the connection string. That is the
 * whole of the SQLite-to-Postgres swap on the application side: point
 * DATABASE_URL at Neon, change the datasource provider in schema.prisma, and
 * re-run the migration. Nothing else imports a dialect.
 */
function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and follow the setup section of the README.",
    );
  }

  const adapter = url.startsWith("file:")
    ? new PrismaBetterSqlite3({ url })
    : new PrismaPg({ connectionString: url });

  return new PrismaClient({ adapter });
}

// Next's dev server re-evaluates modules on every edit, which would otherwise
// open a new connection pool per hot reload until the database refuses more.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
