"use server";

import { db } from "@/lib/db";
import { Plan, type Agency } from "@prisma/client";
import { billingService } from "@/lib/services/billing.service";
import { logger } from "@/lib/utils";

export const getAgencyDetails = async (agencyId: string) => {
  try {
    if (!agencyId) return null;

    await billingService.ensureFreeSubscription(agencyId);

    const agencyDetails = await db.agency.findUnique({
      where: { id: agencyId },
      include: {
        subAccounts: true,
        subscriptions: true,
      },
    });

    if (!agencyDetails) throw new Error("Agency not found");

    return agencyDetails;
  } catch (error) {
    logger(error);
    return null;
  }
};

export const updateAgencyDetails = async (
  agencyId: string,
  agencyDetails: Partial<Agency>
) => {
  return db.agency.update({
    where: { id: agencyId },
    data: agencyDetails as any,
  });
};

export const deleteAgency = async (agencyId: string) => {
  return db.agency.delete({
    where: { id: agencyId },
    include: { subAccounts: true },
  });
};

export const upsertAgency = async (agency: Partial<Agency>, price?: Plan) => {
  try {
    if (!agency.companyEmail) return null;

    // 🔥 STEP 1: ENSURE USER EXISTS (CRITICAL FIX)
    let user = await db.user.findUnique({
      where: { email: agency.companyEmail },
    });

    if (!user) {
      user = await db.user.create({
        data: {
          email: agency.companyEmail,
          name: agency.name || "Agency User",
          avatarUrl: "",
        },
      });
    }

    // 🔥 STEP 2: SAFE UPSERT (NO CONNECT ERROR)
    const agencyDetails = await db.agency.upsert({
      where: {
        id: agency.id || "__new__", // avoid undefined crash
      },
      update: {
        ...agency,
      } as any,
      create: {
        ...agency,
        users: {
          connect: {
            id: user.id, // ✅ FIX: connect by existing user ID
          },
        },
        sidebarOptions: {
          create: [
            {
              name: "Dashboard",
              icon: "category",
              link: `/agency/${agency.id}`,
            },
            {
              name: "Launchpad",
              icon: "clipboardIcon",
              link: `/agency/${agency.id}/launchpad`,
            },
            {
              name: "Billing",
              icon: "payment",
              link: `/agency/${agency.id}/billing`,
            },
            {
              name: "Settings",
              icon: "settings",
              link: `/agency/${agency.id}/settings`,
            },
            {
              name: "Sub Accounts",
              icon: "person",
              link: `/agency/${agency.id}/all-subaccounts`,
            },
            {
              name: "Team",
              icon: "shield",
              link: `/agency/${agency.id}/team`,
            },
          ],
        },
      } as any,
    });

    // 🔥 STEP 3: ENSURE SUBSCRIPTION
    await billingService.ensureFreeSubscription(agencyDetails.id);

    return agencyDetails;
  } catch (error) {
    logger(error);
    throw error;
  }
};

export const getAgencySubscription = async (agencyId: string) => {
  if (!agencyId) return null;

  await billingService.ensureFreeSubscription(agencyId);

  return db.agency.findUnique({
    where: { id: agencyId },
    select: {
      customerId: true,
      subscriptions: true,
    },
  });
};

export const updateAgencyConnectedId = async (
  agencyId: string,
  connectAccountId: string
) => {
  return db.agency.update({
    where: { id: agencyId },
    data: { connectAccountId },
  });
};