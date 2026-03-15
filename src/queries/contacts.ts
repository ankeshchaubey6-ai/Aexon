"use server";

import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

/**
 * 🔥 PRODUCTION FIXED (MySQL Safe)
 * - Removed mode: "insensitive" (NOT supported in MySQL)
 * - Added subAccountId filter (CRITICAL for CRM)
 * - Returns initial contacts when search is empty (fixes customer dropdown disappearing)
 * - Safe trim handling (no undefined crash)
 */
export const searchContacts = async (
  searchTerms: string,
  subAccountId?: string
) => {
  try {
    const safeSearch = (searchTerms ?? "").toString().trim();

    // 🔥 IMPORTANT:
    // When user opens dropdown with empty search,
    // we should still return recent contacts (fixes "customer option removed" issue)
    if (!safeSearch) {
      if (!subAccountId) return [];

      return await db.contact.findMany({
        where: {
          subAccountId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 20, // prevent heavy query
      });
    }

    return await db.contact.findMany({
      where: {
        AND: [
          {
            name: {
              // MySQL default collation is already case-insensitive
              contains: safeSearch,
            },
          },
          ...(subAccountId
            ? [
                {
                  subAccountId,
                },
              ]
            : []),
        ],
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
    });
  } catch (error) {
    console.error("[searchContacts] ERROR:", error);
    return [];
  }
};

/**
 * Get subaccount with contacts (safe + unchanged logic)
 */
export const getSubAccountWithContacts = async (subAccountId: string) => {
  if (!subAccountId) return null;

  try {
    return await db.subAccount.findUnique({
      where: {
        id: subAccountId,
      },
      include: {
        contacts: {
          include: {
            tickets: {
              select: {
                value: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });
  } catch (error) {
    console.error("[getSubAccountWithContacts] ERROR:", error);
    return null;
  }
};

/**
 * 🔥 BULLETPROOF upsertContact (FINAL FIX)
 * Fixes:
 * - "name and email required"
 * - trim undefined crash
 * - duplicate contact creation
 * - unstable Prisma upsert IDs
 */
export const upsertContact = async (contact: {
  id?: string;
  name: string;
  email: string;
  subAccountId: string;
}) => {
  try {
    console.log("[upsertContact] START:", contact);

    if (!contact?.subAccountId) {
      throw new Error("subAccountId is required");
    }

    // 🔥 SAFE STRING HANDLING (prevents trim/undefined crash)
    const safeName = (contact?.name ?? "").toString().trim();
    const safeEmail = (contact?.email ?? "")
      .toString()
      .trim()
      .toLowerCase();

    if (!safeName) {
      throw new Error("Name is required");
    }

    if (!safeEmail) {
      throw new Error("Email is required");
    }

    // 🔥 CRITICAL:
    // Use stable ID only if provided (edit mode),
    // otherwise generate new (create mode)
    const contactId = contact.id && contact.id !== "" ? contact.id : uuidv4();

    const response = await db.contact.upsert({
      where: {
        id: contactId,
      },
      update: {
        name: safeName,
        email: safeEmail,
        subAccountId: contact.subAccountId, // ensure consistency
      },
      create: {
        id: contactId,
        name: safeName,
        email: safeEmail,
        subAccountId: contact.subAccountId,
      },
    });

    console.log("[upsertContact] SUCCESS:", response.id);
    return response;
  } catch (error) {
    console.error("[upsertContact] FAILED:", error);
    throw error;
  }
};