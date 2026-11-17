import { Prisma, PrismaClient } from "@prisma/client";

// Neon free-tier compute sleeps after ~5 minutes idle and takes a few seconds
// to wake. Prisma's default connect timeout is 5s, so the first query after a
// sleep can fail with "Can't reach database server" (P1001). Give the
// connection longer, and retry connection-level failures.
const CONNECT_TIMEOUT_SECONDS = 15;
const RETRY_DELAYS_MS = [500, 1500, 3000];

function datasourceUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has("connect_timeout")) {
      url.searchParams.set("connect_timeout", String(CONNECT_TIMEOUT_SECONDS));
    }
    return url.toString();
  } catch {
    return raw;
  }
}

// Only errors where the query never reached the database, so a retry cannot
// run a write twice.
function isConnectionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P1001" || error.code === "P1002")
  );
}

function createClient() {
  return new PrismaClient({ datasourceUrl: datasourceUrl() }).$extends({
    query: {
      async $allOperations({ args, query }) {
        for (let attempt = 0; ; attempt++) {
          try {
            return await query(args);
          } catch (error) {
            if (!isConnectionError(error) || attempt >= RETRY_DELAYS_MS.length) throw error;
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
          }
        }
      },
    },
  });
}

type AppPrismaClient = ReturnType<typeof createClient>;

const globalForPrisma = globalThis as unknown as { prisma?: AppPrismaClient };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
