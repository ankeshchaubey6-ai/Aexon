import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.prisma || new PrismaClient();

// ✅ ADD THIS LINE (CRITICAL FIX)
export const db = prisma;

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}