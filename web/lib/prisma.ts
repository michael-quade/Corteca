import { PrismaClient } from "@prisma/client";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Neon is reached through its serverless driver (WebSocket on port 443): Prisma's
// own Postgres connection to Neon's pooler failed from Vercel ("Can't reach
// database server"), and port 5432 is blocked on the corporate network anyway.
function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? "";
  if (!/\.neon\.tech[/:]/.test(url)) return new PrismaClient({ log: ["error", "warn"] });
  neonConfig.webSocketConstructor = ws;
  const adapter = new PrismaNeon(new Pool({ connectionString: url }));
  return new PrismaClient({ adapter, log: ["error", "warn"] });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
