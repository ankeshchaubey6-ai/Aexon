"use server";

import { db } from "@/lib/db";
import { Plan, type Agency } from "@prisma/client";
import { billingService } from "@/lib/services/billing.service";
import { logger } from "@/lib/utils";

export const getAgencyDetails = async (agencyId: string) => {
  try {
    if (!agencyId) return null;

    // AUTO CREATE FREE SUBSCRIPTION (FULL UNLOCK)
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
  if (!agency.companyEmail) return null;

  const agencyDetails = await db.agency.upsert({
    where: { id: agency.id! },
    update: agency as any,
    create: {
      users: {
        connect: { email: agency.companyEmail },
      },
      ...agency,
      sidebarOptions: {
        create: [
          { name: "Dashboard", icon: "category", link: `/agency/${agency.id}` },
          { name: "Launchpad", icon: "clipboardIcon", link: `/agency/${agency.id}/launchpad` },
          { name: "Billing", icon: "payment", link: `/agency/${agency.id}/billing` },
          { name: "Settings", icon: "settings", link: `/agency/${agency.id}/settings` },
          { name: "Sub Accounts", icon: "person", link: `/agency/${agency.id}/all-subaccounts` },
          { name: "Team", icon: "shield", link: `/agency/${agency.id}/team` },
        ],
      },
    } as any,
  });

  // AUTO FREE PLAN CREATION
  await billingService.ensureFreeSubscription(agencyDetails.id);

  return agencyDetails;
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