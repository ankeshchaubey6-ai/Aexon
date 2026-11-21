"use server";

import { db } from "@/lib/db";
import { logger } from "@/lib/utils";
import { type NotificationsWithUser } from "@/lib/types";

export const saveActivityLogsNotification = async ({
  agencyId,
  description,
  subAccountId,
}: {
  agencyId?: string;
  subAccountId?: string;
  description: string;
}) => {
  if (!agencyId && !subAccountId) {
    throw new Error("You need to provide at least an agency id or subaccount id");
  }

  const userData = await db.user.findFirst({
    where: subAccountId
      ? { agency: { subAccounts: { some: { id: subAccountId } } } }
      : { agencyId: agencyId ?? undefined },
    select: { id: true, name: true, agencyId: true },
  });

  if (!userData) {
    throw new Error("Could not find a user");
  }

  const foundAgencyId = agencyId ?? userData.agencyId;
  if (!foundAgencyId) throw new Error("Could not resolve the agency for this activity");

  if (subAccountId) {
    await db.notification.create({
      data: {
        notification: `${userData.name} | ${description}`,
        user: {
          connect: {
            id: userData.id,
          },
        },
        agency: {
          connect: {
            id: foundAgencyId,
          },
        },
        subAccount: {
          connect: {
            id: subAccountId,
          },
        },
      },
    });
  } else {
    await db.notification.create({
      data: {
        notification: `${userData.name} | ${description}`,
        user: {
          connect: {
            id: userData.id,
          },
        },
        agency: {
          connect: {
            id: foundAgencyId,
          },
        },
      },
    });
  }
};

export const getNotification = async (agencyId: string, subAccountId?: string) => {
  try {
    const response = await db.notification.findMany({
      where: {
        agencyId,
        ...(subAccountId ? { subAccountId } : {}),
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        notification: true,
        agencyId: true,
        subAccountId: true,
        userId: true,
        user: {
          select: { id: true, name: true, avatarUrl: true, email: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    return response as NotificationsWithUser;
  } catch (error) {
    logger(error);
  }
};
