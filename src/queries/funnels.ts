"use server";

import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import type { FunnelDetailsSchema } from "@/lib/validators/funnel-details";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { assertSubAccountAccess } from "@/lib/auth/tenant";

/**
 * Get all funnels for a subaccount
 */
export const getFunnels = async (subAccountId: string) => {
  if (!subAccountId) {
    console.warn("[getFunnels] Missing subAccountId");
    return [];
  }

  try {
    await assertSubAccountAccess(subAccountId);
    const response = await db.funnel.findMany({
      where: { subAccountId },
      include: {
        funnelPages: {
          orderBy: { order: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return response;
  } catch (error) {
    console.error("[getFunnels] ERROR:", error);
    throw error;
  }
};

/**
 * Get single funnel
 */
export const getFunnel = async (funnelId: string) => {
  if (!funnelId) {
    console.warn("[getFunnel] Missing funnelId");
    return null;
  }

  try {
    const response = await db.funnel.findUnique({
      where: { id: funnelId },
      include: {
        funnelPages: {
          orderBy: { order: "asc" },
        },
        payments: true,
      },
    });

    if (response) await assertSubAccountAccess(response.subAccountId);

    return response;
  } catch (error) {
    console.error("[getFunnel] ERROR:", error);
    throw error;
  }
};

/**
 * 🔥 CRITICAL FIXED: Create or Update Funnel
 * - No spread operator
 * - Required field validation (name)
 * - Prevents Prisma crash
 * - Proper revalidation
 */
export const upsertFunnel = async (
  subAccountId: string,
  funnel: FunnelDetailsSchema & { liveProducts?: string },
  funnelId?: string
) => {
  if (!subAccountId) {
    throw new Error("[upsertFunnel] subAccountId is required");
  }

  if (!funnel) {
    throw new Error("[upsertFunnel] funnel payload is missing");
  }

  const name = funnel.name?.trim();

  // 🔥 THIS WAS YOUR CRASH ROOT CAUSE
  if (!name) {
    throw new Error("Funnel name is required");
  }

  try {
    await assertSubAccountAccess(subAccountId);
    console.log("[upsertFunnel] START", {
      subAccountId,
      funnelId,
      name,
    });

    const safeLiveProducts =
      funnel.liveProducts && funnel.liveProducts.length > 0
        ? funnel.liveProducts
        : "[]";

    const id = funnelId || uuidv4();

    const response = await db.funnel.upsert({
      where: { id },

      // ✅ NO SPREAD (prevents undefined fields crash)
      update: {
        name: name,
        description: funnel.description ?? "",
        subDomainName: funnel.subDomainName ?? null,
        favicon: funnel.favicon ?? null,
        liveProducts: safeLiveProducts,
      },

      create: {
        id,
        subAccountId,
        name: name, // REQUIRED FIELD (fixed)
        description: funnel.description ?? "",
        subDomainName: funnel.subDomainName ?? null,
        favicon: funnel.favicon ?? null,
        liveProducts: safeLiveProducts,
      },
    });

    // 🔥 IMPORTANT: Revalidate all funnel routes
    revalidatePath(`/subaccount/${subAccountId}/funnels`);
    revalidatePath(`/subaccount/${subAccountId}/funnels/${id}`);

    console.log("[upsertFunnel] SUCCESS:", response.id);
    return response;
  } catch (error) {
    console.error("[upsertFunnel] FAILED:", error);
    throw error;
  }
};

/**
 * Update ONLY dynamic products
 */
export const updateFunnelProducts = async (
  products: string,
  funnelId: string
) => {
  if (!funnelId) {
    throw new Error("[updateFunnelProducts] funnelId is required");
  }

  try {
    const funnel = await db.funnel.findUnique({
      where: { id: funnelId },
      select: { subAccountId: true },
    });
    if (!funnel) throw new Error("Funnel not found");
    await assertSubAccountAccess(funnel.subAccountId);

    let parsed = "[]";
    try {
      parsed = products ? JSON.stringify(JSON.parse(products)) : "[]";
    } catch {
      parsed = "[]";
    }

    const response = await db.funnel.update({
      where: { id: funnelId },
      data: { liveProducts: parsed },
    });

    console.log("[updateFunnelProducts] SUCCESS:", funnelId);
    return response;
  } catch (error) {
    console.error("[updateFunnelProducts] ERROR:", error);
    throw error;
  }
};

/**
 * Create or Update Funnel Page
 */
export const upsertFunnelPage = async (
  subAccountId: string,
  funnelId: string,
  funnelPage: Prisma.FunnelPageCreateWithoutFunnelInput
) => {
  if (!subAccountId || !funnelId) {
    throw new Error("[upsertFunnelPage] Missing subAccountId or funnelId");
  }

  if (!funnelPage?.name) {
    throw new Error("Funnel page name is required");
  }

  try {
    await assertSubAccountAccess(subAccountId);
    const funnel = await db.funnel.findFirst({
      where: { id: funnelId, subAccountId },
      select: { id: true },
    });
    if (!funnel) throw new Error("Funnel not found");

    const pageId = funnelPage.id || uuidv4();

    const response = await db.funnelPage.upsert({
      where: { id: pageId },

      update: {
        name: funnelPage.name,
        pathName: funnelPage.pathName ?? "",
        order: funnelPage.order,
        content: funnelPage.content,
      },

      create: {
        id: pageId,
        funnelId,
        name: funnelPage.name,
        pathName: funnelPage.pathName ?? "",
        order: funnelPage.order,
        content:
          funnelPage.content ??
          JSON.stringify([
            {
              id: "__body",
              name: "Body",
              type: "__body",
              styles: { backgroundColor: "white" },
              content: [],
            },
          ]),
      },
    });

    revalidatePath(`/subaccount/${subAccountId}/funnels/${funnelId}`);
    revalidatePath(`/subaccount/${subAccountId}/funnels`);

    console.log("[upsertFunnelPage] SUCCESS:", response.id);
    return response;
  } catch (error) {
    console.error("[upsertFunnelPage] ERROR:", error);
    throw error;
  }
};

/**
 * Delete Funnel Page
 */
export const deleteFunnelPage = async (funnelPageId: string) => {
  if (!funnelPageId) {
    throw new Error("[deleteFunnelPage] funnelPageId is required");
  }

  try {
    const response = await db.funnelPage.delete({
      where: { id: funnelPageId },
    });

    console.log("[deleteFunnelPage] SUCCESS:", funnelPageId);
    return response;
  } catch (error) {
    console.error("[deleteFunnelPage] ERROR:", error);
    throw error;
  }
};

/**
 * Get funnel page details
 */
export const getFunnelPageDetails = async (funnelPageId: string) => {
  if (!funnelPageId) return null;

  try {
    return await db.funnelPage.findUnique({
      where: { id: funnelPageId },
    });
  } catch (error) {
    console.error("[getFunnelPageDetails] ERROR:", error);
    throw error;
  }
};

/**
 * Increment page visits (non-critical)
 */
export const updateFunnelPageVisits = async (funnelPageId: string) => {
  if (!funnelPageId) return null;

  try {
    return await db.funnelPage.update({
      where: { id: funnelPageId },
      data: {
        visits: {
          increment: 1,
        },
      },
    });
  } catch (error) {
    console.error("[updateFunnelPageVisits] ERROR:", error);
    return null;
  }
};
