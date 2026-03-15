"use server";

import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

// 🔥 DTO (Serializable for Next.js Server Actions)
export interface UpsertSubAccountPayload {
  id?: string;
  agencyId: string;
  name: string;
  companyEmail: string;
  companyPhone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  subAccountLogo?: string;
  goal?: number;
  connectAccountId?: string;
}

/**
 * 🔥 CRITICAL FIX:
 * This was MISSING and breaking:
 * - TicketDetails
 * - Pipelines
 * - Funnel saving flow
 * - Entire module graph (Next.js Fast Refresh loop)
 */
export const getSubAccountTeamMembers = async (subAccountId: string) => {
  if (!subAccountId) {
    console.warn("[getSubAccountTeamMembers] subAccountId missing");
    return [];
  }

  try {
    console.log(
      "[getSubAccountTeamMembers] Fetching team members for:",
      subAccountId
    );

    const permissions = await db.permissions.findMany({
      where: {
        subAccountId,
        access: true,
      },
      include: {
        user: true,
      },
    });

    const teamMembers = permissions
      .map((perm) => perm.user)
      .filter((user) => user !== null);

    console.log(
      "[getSubAccountTeamMembers] SUCCESS - members:",
      teamMembers.length
    );

    return teamMembers;
  } catch (error) {
    console.error("[getSubAccountTeamMembers] FAILED:", error);
    return [];
  }
};

export const getSubAccountDetails = async (subAccountId: string) => {
  if (!subAccountId) return null;

  try {
    const result = await db.subAccount.findUnique({
      where: { id: subAccountId },
    });

    console.log("[getSubAccountDetails] RETRIEVED:", {
      id: result?.id,
      name: result?.name,
      email: result?.companyEmail,
    });

    return result;
  } catch (error) {
    console.error("[getSubAccountDetails] FAILED:", error);
    throw error;
  }
};

export const getSubAccountsByAgency = async (agencyId: string) => {
  if (!agencyId) return [];

  try {
    return await db.subAccount.findMany({
      where: { agencyId },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("[getSubAccountsByAgency] FAILED:", error);
    throw error;
  }
};

export const upsertSubAccount = async (payload: UpsertSubAccountPayload) => {
  try {
    console.log("[upsertSubAccount] === START UPSERT ===");

    if (!payload.companyEmail) {
      throw new Error("Company email is required");
    }

    const companyEmail = payload.companyEmail.trim();

    if (!companyEmail) {
      throw new Error("Company email is required");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(companyEmail)) {
      throw new Error(`Invalid email format: ${companyEmail}`);
    }

    if (!payload.agencyId) {
      throw new Error("Agency ID is required");
    }

    const subAccountId = payload.id ?? uuidv4();
    const permissionId = uuidv4();

    const agencyOwner = await db.user.findFirst({
      where: {
        agencyId: payload.agencyId,
        role: Role.AGENCY_OWNER,
      },
    });

    if (!agencyOwner) {
      throw new Error("Agency owner not found");
    }

    const updateData = {
      name: payload.name?.trim() ?? "",
      companyEmail: companyEmail,
      companyPhone: payload.companyPhone?.trim() ?? "",
      address: payload.address?.trim() ?? "",
      city: payload.city?.trim() ?? "",
      state: payload.state?.trim() ?? "",
      zipCode: payload.zipCode?.trim() ?? "",
      country: payload.country?.trim() ?? "",
      subAccountLogo: payload.subAccountLogo ?? "",
      goal: payload.goal ?? 5000,
      connectAccountId: payload.connectAccountId ?? "",
    };

    const createData = {
      id: subAccountId,
      name: payload.name?.trim() ?? "",
      companyEmail: companyEmail,
      companyPhone: payload.companyPhone?.trim() ?? "",
      address: payload.address?.trim() ?? "",
      city: payload.city?.trim() ?? "",
      state: payload.state?.trim() ?? "",
      zipCode: payload.zipCode?.trim() ?? "",
      country: payload.country?.trim() ?? "",
      subAccountLogo: payload.subAccountLogo ?? "",
      goal: payload.goal ?? 5000,
      connectAccountId: payload.connectAccountId ?? "",
      agencyId: payload.agencyId,

      permissions: {
        create: {
          id: permissionId,
          access: true,
          email: agencyOwner.email,
        },
      },

      pipelines: {
        create: {
          name: "Lead Cycle",
        },
      },

      sidebarOptions: {
        create: [
          {
            name: "Launchpad",
            icon: "clipboardIcon",
            link: `/subaccount/${subAccountId}/launchpad`,
          },
          {
            name: "Settings",
            icon: "settings",
            link: `/subaccount/${subAccountId}/settings`,
          },
          {
            name: "Funnels",
            icon: "pipelines",
            link: `/subaccount/${subAccountId}/funnels`,
          },
          {
            name: "Media",
            icon: "database",
            link: `/subaccount/${subAccountId}/media`,
          },
          {
            name: "Automations",
            icon: "chip",
            link: `/subaccount/${subAccountId}/automations`,
          },
          {
            name: "Pipelines",
            icon: "flag",
            link: `/subaccount/${subAccountId}/pipelines`,
          },
          {
            name: "Contacts",
            icon: "person",
            link: `/subaccount/${subAccountId}/contacts`,
          },
          {
            name: "Dashboard",
            icon: "category",
            link: `/subaccount/${subAccountId}`,
          },
        ],
      },
    };

    const response = await db.subAccount.upsert({
      where: { id: subAccountId },
      update: updateData,
      create: createData,
    });

    console.log("[upsertSubAccount] SUCCESS:", response.id);
    return response;
  } catch (error) {
    console.error("[upsertSubAccount] FAILED:", error);
    throw error instanceof Error
      ? error
      : new Error(`upsertSubAccount failed: ${String(error)}`);
  }
};

export const deleteSubAccount = async (subAccountId: string) => {
  if (!subAccountId) return null;

  try {
    await db.permissions.deleteMany({
      where: { subAccountId },
    });

    return await db.subAccount.delete({
      where: { id: subAccountId },
    });
  } catch (error) {
    console.error("[deleteSubAccount] FAILED:", error);
    throw error;
  }
};

export const updateSubAccountConnectedId = async (
  subAccountId: string,
  connectAccountId: string
) => {
  if (!subAccountId) {
    throw new Error("subAccountId is required");
  }

  try {
    return await db.subAccount.update({
      where: { id: subAccountId },
      data: { connectAccountId },
    });
  } catch (error) {
    console.error("[updateSubAccountConnectedId] FAILED:", error);
    throw error;
  }
};