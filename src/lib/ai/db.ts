// src/lib/db.ts
// ✅ FIXED: Import PrismaClient from @prisma/client (standard path).
// Your schema uses default output so @/generated/prisma does not exist.
// Also exports both `prisma` (used by AI queries) and `db` (used by billing etc.)

import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

export const prisma = globalForPrisma.prisma || new PrismaClient();
export const db = prisma; // alias — billing.service.ts uses `db`

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}